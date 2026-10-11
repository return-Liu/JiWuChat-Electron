import { ref, unref, type Ref } from "vue";
import { resolveWallpaperUrl } from "~/utils/wallpaper";

/**
 * 个性装扮壁纸预览：加载状态 + 悬停播放 + 错误处理。
 *
 * - 状态机：每张壁纸只有 idle / loading / loaded / failed 四种状态，互斥且集中管理，
 *   视频与图片共用同一套状态，避免「既加载中又失败」这类非法态；
 * - 懒加载：卡片由外层虚拟滚动控制渲染范围（含 overscan 预加载缓冲），
 *   渲染出来即挂缩略图；带封面（poster）的视频只有悬停后才加载视频本体；
 * - 加载态：pending 时展示骨架（无封面）或轻量指示（有封面，画面不闪）；
 * - 错误处理：失败可重试，重试通过 cache-buster 强制重新请求，次数不受限（用户主动行为）；
 * - 悬停播放：鼠标进入才播放，离开即暂停回到首帧，同一时刻只有一项在播。
 *
 * 抽离为 composable，便于其它需要壁纸预览的页面复用。
 *
 * 说明：不再用 IntersectionObserver 做可见性判定——虚拟滚动本身已经决定渲染哪些卡片，
 * 再叠一层 IO 属于重复机制，还会引入 visibleMap 永久为 true 的语义问题，故已移除。
 */
export interface PreviewWallpaper {
  name: string;
  type: "video" | "image";
  url: string;
  /** 视频首帧封面；存在时卡片默认只显示封面，悬停才加载视频 */
  poster?: string;
}

/** 单张壁纸的预览状态 */
export type PreviewStatus = "idle" | "loading" | "loaded" | "failed";

export type WallpaperSource<T> = T | Ref<T> | (() => T);

export const useWallpaperPreview = (source: WallpaperSource<PreviewWallpaper[]>) => {
  /** 支持数组 / ref / getter，壁纸列表动态变化时自动跟随 */
  const resolveItems = (): PreviewWallpaper[] => {
    if (typeof source === "function") return (source as () => PreviewWallpaper[])();
    return (unref(source as Ref<PreviewWallpaper[]>) as PreviewWallpaper[]) ?? [];
  };

  const statusMap = ref<Record<number, PreviewStatus>>({});
  /** index -> 已激活（悬停过）的视频，激活后才真正加载视频本体 */
  const activatedMap = ref<Record<number, boolean>>({});
  /** index -> 重试次数，用于 cache-buster */
  const attemptMap = ref<Record<number, number>>({});
  const previewingIndex = ref<number | null>(null);

  /** index -> 卡片 DOM，用于暂停时定位 video */
  const cardMap = new Map<number, HTMLElement>();

  const encodeUrl = (url: string) => {
    if (!url) return "";
    try {
      return encodeURI(url);
    } catch {
      return url;
    }
  };

  /** 重试时追加 cache-buster，避免命中浏览器的失败缓存 */
  const withAttempt = (url: string, index: number) => {
    const attempt = attemptMap.value[index] ?? 0;
    if (!attempt) return url;
    return url.includes("?") ? `${url}&wvp-retry=${attempt}` : `${url}?wvp-retry=${attempt}`;
  };

  /**
   * 模板 ref 回调：<div :ref="(el) => registerCard(el, index)">
   * 仅负责收集卡片 DOM；卡片被虚拟滚动卸载时复位其状态，避免响应式对象永久累积。
   */
  const registerCard = (target: unknown, index: number) => {
    // template ref 可能传入 DOM 元素或组件实例，统一取出真实元素
    const raw = (target as { $el?: HTMLElement } | null) ?? null;
    const candidate = (raw?.$el ?? (target as Element | null)) as Element | null;
    const el = candidate instanceof Element ? candidate : null;

    if (!el) {
      // 卡片被虚拟滚动卸载：释放 DOM 引用并复位该卡片的预览状态
      cardMap.delete(index);
      delete attemptMap.value[index];
      delete activatedMap.value[index];
      delete statusMap.value[index];
      return;
    }
    cardMap.set(index, el as HTMLElement);
  };

  /** 是否有可立即展示的静态画面（图片本体或视频封面） */
  const hasThumb = (item?: PreviewWallpaper) =>
    !!item && (item.type === "image" || !!item.poster);

  /** 缩略图地址：图片用本体，视频用封面 */
  const thumbSrcOf = (item: PreviewWallpaper | undefined, index: number) => {
    if (!item) return undefined;
    const raw = item.type === "video" ? item.poster : item.url;
    if (!raw) return undefined;
    return withAttempt(encodeUrl(resolveWallpaperUrl(raw)), index);
  };

  /** 视频地址：有封面时仅在悬停激活后返回，无封面时直接加载（保底） */
  const videoSrcOf = (item: PreviewWallpaper | undefined, index: number) => {
    if (!item || item.type !== "video") return undefined;
    if (item.poster && !activatedMap.value[index]) return undefined;
    return withAttempt(encodeUrl(resolveWallpaperUrl(item.url)), index);
  };

  /**
   * 媒体是否正在等待（需要展示加载指示）。
   * 只有在 src 真正被挂载时才算等待，因此有封面的视频在未悬停时不会误判为加载中。
   */
  const isMediaPending = (item: PreviewWallpaper | undefined, index: number) => {
    if (!item) return false;
    const status = statusMap.value[index] ?? "idle";
    if (status === "loaded" || status === "failed") return false;
    const src = item.type === "video" ? videoSrcOf(item, index) : thumbSrcOf(item, index);
    return !!src;
  };

  const hasFailed = (index: number) => (statusMap.value[index] ?? "idle") === "failed";
  const isPreviewing = (index: number) => previewingIndex.value === index;
  const statusOf = (index: number): PreviewStatus => statusMap.value[index] ?? "idle";

  const markLoaded = (index: number) => {
    statusMap.value[index] = "loaded";
  };
  const markFailed = (index: number) => {
    statusMap.value[index] = "failed";
  };

  /**
   * 重试：重置状态并递增次数，src 变化后媒体元素会重新请求。
   * 手动重试不限制次数（用户主动触发，成本可控），且失败后始终留有退路。
   */
  const retry = (index: number) => {
    attemptMap.value[index] = (attemptMap.value[index] ?? 0) + 1;
    statusMap.value[index] = "loading";
  };

  const getVideo = (el: HTMLElement | null | undefined) =>
    (el?.querySelector("video") as HTMLVideoElement | null) ?? null;

  const pausePreview = (index: number) => {
    if (previewingIndex.value === index) previewingIndex.value = null;
    const video = getVideo(cardMap.get(index));
    if (video) {
      video.pause();
      try {
        video.currentTime = 0;
      } catch {
        /* 部分浏览器在未就绪时设置 currentTime 会抛错，忽略即可 */
      }
    }
  };

  /** deferred：有封面时 video 可能在本帧才刚挂载，允许下一帧补取一次（仅一次，避免无限递归） */
  const playPreview = (index: number, cardEl?: HTMLElement | null, deferred = false) => {
    // 保证同一时刻只有一项在播：先停掉上一张（快速划过时避免多个视频同时解码）
    const prev = previewingIndex.value;
    if (prev !== null && prev !== index) pausePreview(prev);

    previewingIndex.value = index;
    // 有封面时首次悬停才真正加载视频本体
    activatedMap.value[index] = true;

    const item = resolveItems()[index];
    if (item?.type !== "video") return;

    const video = getVideo(cardEl ?? cardMap.get(index));
    if (!video) {
      if (item.poster && !deferred) {
        requestAnimationFrame(() => {
          if (previewingIndex.value === index) playPreview(index, cardEl, true);
        });
      }
      return;
    }

    const tryPlay = () => {
      if (previewingIndex.value !== index) return;
      video.play().catch(() => {});
    };
    if (video.readyState >= 2) tryPlay();
    else video.addEventListener("loadeddata", tryPlay, { once: true });
  };

  /** 暂停全部预览（容器滚动、页面隐藏、组件卸载前调用） */
  const pauseAll = () => {
    const current = previewingIndex.value;
    // 没有视频在预览时直接返回：滚动是高频事件，避免每帧都遍历所有卡片做无谓的 querySelector/pause
    if (current === null) return;
    previewingIndex.value = null;
    pausePreview(current);
    // 兜底：停掉其余任何仍在播放的视频（正常只会命中上面这一张，防御性保留）
    cardMap.forEach((el, index) => {
      if (index === current) return;
      const video = getVideo(el);
      if (video && !video.paused) video.pause();
    });
  };

  const dispose = () => {
    pauseAll();
    cardMap.clear();
    statusMap.value = {};
    activatedMap.value = {};
    attemptMap.value = {};
  };

  return {
    previewingIndex: previewingIndex as Ref<number | null>,
    registerCard,
    thumbSrcOf,
    videoSrcOf,
    hasThumb,
    isMediaPending,
    statusOf,
    hasFailed,
    isPreviewing,
    markLoaded,
    markFailed,
    retry,
    playPreview,
    pausePreview,
    pauseAll,
    dispose,
  };
};
