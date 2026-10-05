<template>
  <div class="tab-content">
    <div class="content-header">
      <div>
        <h3 class="content-title">个性装扮</h3>
        <p class="content-desc">选张壁纸，换个聊天心情</p>
      </div>
    </div>

    <!-- 壁纸选择 -->
    <div class="setting-group">
      <div class="group-header">
        <span class="group-title">背景焕新</span>
        <span class="group-desc">悬停感受动态，点击即刻生效</span>
      </div>

      <!-- 虚拟滚动容器：只渲染可视区域内的壁纸卡片 -->
      <div ref="gridScrollRef" class="wallpaper-scroll" :style="cssVars" @scroll.passive="pauseAll">
        <div class="wallpaper-grid" :style="{ height: `${totalHeight}px` }">
          <div
            v-for="item in visibleItems"
            :key="`dynamic-${item.index}`"
            :ref="cardRef(item.index)"
            class="wvp-card"
            :class="{ active: isThemeActive(item.index), playing: isPreviewing(item.index) }"
            :style="itemStyle(item)"
            role="button"
            tabindex="0"
            :aria-pressed="isThemeActive(item.index)"
            :aria-label="`应用壁纸：${wallpapers[item.index]?.name ?? item.index}`"
            @click="selectTheme(item.index)"
            @keydown.enter.prevent="selectTheme(item.index)"
            @keydown.space.prevent="selectTheme(item.index)"
            @mouseenter="onCardEnter(item.index, $event)"
            @mouseleave="onCardLeave(item.index)"
            @focus="onCardEnter(item.index, $event)"
            @blur="onCardLeave(item.index)"
          >
            <!-- 视频壁纸：默认只展示封面，悬停/聚焦才加载视频本体 -->
            <video
              v-if="wallpapers[item.index]?.type === 'video'"
              class="wvp-media"
              :poster="thumbSrcOf(wallpapers[item.index], item.index)"
              :src="videoSrcOf(wallpapers[item.index], item.index)"
              muted
              loop
              playsinline
              preload="metadata"
              @loadeddata="markLoaded(item.index)"
              @error="markFailed(item.index)"
            ></video>
            <img
              v-else
              class="wvp-media"
              :src="thumbSrcOf(wallpapers[item.index], item.index)"
              :alt="wallpapers[item.index]?.name"
              loading="lazy"
              decoding="async"
              @load="markLoaded(item.index)"
              @error="markFailed(item.index)"
            />

            <!-- 加载失败：可重试，次数不限 -->
            <div v-if="hasFailed(item.index)" class="wvp-failed">
              <i class="iconfont icon-tishi"></i>
              <span>加载失败</span>
              <button class="wvp-retry" type="button" @click.stop="onRetry(item.index)">
                重试
              </button>
            </div>
            <!-- 加载中：有封面时用轻量指示，避免遮住已显示的画面 -->
            <div
              v-else-if="isMediaPending(wallpapers[item.index], item.index)"
              class="wvp-skeleton"
              :class="{ subtle: hasThumb(wallpapers[item.index]) }"
            >
              <span class="wvp-spinner"></span>
            </div>

            <div class="wvp-name">{{ wallpapers[item.index]?.name }}</div>
          </div>
        </div>

        <div v-if="!visibleItems.length" class="wvp-empty">暂无可用壁纸</div>
      </div>
    </div>

    <!-- 卡片外面的提示（测试版说明） -->
    <div class="palette-tip">
      <div class="palette-tip-row">
        <i class="iconfont icon-tishi"></i>
        <span>壁纸适配优化中，部分场景可能存在显示差异，我们将持续改进，感谢反馈～</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { message, Modal } from "ant-design-vue";
import { useSiderColor, DYNAMIC_WALLPAPERS } from "../../stores/siderColor";
import { useTheme } from "../../composables/useTheme";
import { useVirtualGrid } from "../../composables/useVirtualGrid";
import { useWallpaperPreview } from "../../composables/useWallpaperPreview";
import { WALLPAPER_CARD, buildWallpaperVars } from "../../constants/wallpaper";

// 统一样式变量：布局与主题色均来自 constants/wallpaper，改一处即可全局生效。
// 卡片尺寸随容器宽度自适应拉伸（fillWidth），因此做成响应式 computed。
const cssVars = computed(() =>
  buildWallpaperVars({
    width: cardWidth.value || WALLPAPER_CARD.width,
    height: cardHeight.value || WALLPAPER_CARD.height,
  }),
);

const siderColorStore = useSiderColor();
const { theme: isDarkRef, setThemeMode } = useTheme();

// 夜间模式下个性装扮壁纸会被暗色主题覆盖，需要先切回日间模式
const isDarkMode = computed(() => !!isDarkRef.value);

// 个性装扮壁纸列表（来自 store）
const wallpapers = DYNAMIC_WALLPAPERS;

const gridScrollRef = ref<HTMLElement | null>(null);

// ===== 虚拟滚动 =====
// fillWidth：卡片按容器宽度均摊拉伸（保持宽高比），消除行尾右侧大片空白
const { totalHeight, visibleItems, itemStyle, cardWidth, cardHeight } = useVirtualGrid({
  count: computed(() => wallpapers.length),
  containerRef: gridScrollRef,
  itemWidth: WALLPAPER_CARD.width,
  itemHeight: WALLPAPER_CARD.height,
  gap: WALLPAPER_CARD.gap,
  overscan: WALLPAPER_CARD.overscanRows,
  fillWidth: true,
  // 窄容器（设置面板侧栏收窄到单列）时封顶卡片宽度，避免被拉伸得异常大
  maxItemWidth: WALLPAPER_CARD.width * 1.5,
});

// ===== 预览：加载态 + 悬停播放 =====
const {
  registerCard,
  thumbSrcOf,
  videoSrcOf,
  hasThumb,
  isMediaPending,
  hasFailed,
  retry,
  isPreviewing,
  markLoaded,
  markFailed,
  playPreview,
  pausePreview,
  pauseAll,
  dispose: disposePreview,
} = useWallpaperPreview(() => wallpapers);

/**
 * 模板 ref 收集：把卡片 DOM 交给 useWallpaperPreview，用于悬停播放时定位 video。
 *
 * 必须按 index 缓存回调：虚拟滚动每次滚动都会重渲染，若每次返回新函数，
 * Vue 会认为 ref 变化而先以 null 再以元素重复调用，造成无谓的卸载/重建抖动
 * （滚动中正在重试的卡片还会因此丢失重试计数）。
 */
const cardRefCache = new Map<number, (el: unknown) => void>();
const cardRef = (index: number) => {
  let fn = cardRefCache.get(index);
  if (!fn) {
    fn = (el: unknown) => registerCard(el, index);
    cardRefCache.set(index, fn);
  }
  return fn;
};

onBeforeUnmount(() => {
  cardRefCache.clear();
  disposePreview();
});

/** 鼠标悬停或键盘聚焦都会激活预览 */
const onCardEnter = (index: number, event: Event) => {
  playPreview(index, event.currentTarget as HTMLElement);
};
const onCardLeave = (index: number) => {
  pausePreview(index);
};
/** 失败后重试：次数不受限，始终留有退路 */
const onRetry = (index: number) => {
  retry(index);
};

const isThemeActive = (index: number) =>
  siderColorStore.currentThemeType === "dynamic" && siderColorStore.currentPaletteIndex === index;

const applyTheme = (index: number) => {
  siderColorStore.setTheme(index);
};

const selectTheme = (index: number) => {
  // 夜间模式下个性装扮壁纸不会显示，先征询是否切回日间模式
  if (isDarkMode.value) {
    Modal.confirm({
      title: "要切换到日间模式吗？",
      content: "此装扮仅在日间模式下绽放，切换日间模式即可欣赏其完整风采",
      okText: "切换",
      cancelText: "取消",
      centered: true,
      onOk() {
        setThemeMode("light");
        applyTheme(index);
        message.success("已切换为日间模式，壁纸已生效");
      },
    });
    return;
  }
  applyTheme(index);
};
</script>

<style lang="scss" scoped>
.wallpaper-scroll {
  height: var(--wvp-viewport-height);
  overflow-y: auto;
  overflow-x: hidden;
  padding: 2px var(--wvp-card-gap) var(--wvp-card-gap);
  scrollbar-width: thin;

  // 虚拟滚动占位容器
  .wallpaper-grid {
    position: relative;
    width: 100%;
  }

  .wvp-card {
    position: absolute;
    top: 0;
    left: 0;
    width: var(--wvp-card-width);
    height: var(--wvp-card-height);
    border-radius: var(--wvp-card-radius);
    overflow: hidden;
    cursor: pointer;
    display: flex;
    align-items: flex-end;
    border: 2px solid transparent;
    background: var(--wvp-surface);
    transition:
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      filter 0.2s ease;

    &:hover {
      border-color: var(--wvp-accent-soft);
    }

    // 键盘可达：聚焦时给出与悬停一致的可见反馈
    &:focus-visible {
      outline: none;
      border-color: var(--wvp-accent);
    }

    &.active {
      border-color: var(--wvp-accent);
    }

    // 播放中：在选中/悬停之外再给出投影与提亮，便于区分
    // 注意：位移不能再用 transform（内联 translate3d 用于虚拟滚动定位，优先级更高）
    &.playing {
      border-color: var(--wvp-accent);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.18);
      filter: brightness(1.06);
    }

    .wvp-media {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
    }
  }

  // 加载骨架
  .wvp-skeleton {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--wvp-skeleton-bg);
    z-index: 2;

    .wvp-spinner {
      width: 20px;
      height: 20px;
      border: 2px solid var(--wvp-border);
      border-top-color: var(--wvp-accent);
      border-radius: 50%;
      animation: wvp-spin 0.8s linear infinite;
    }

    // 已有封面在展示：不遮挡画面，只给一个轻量指示
    &.subtle {
      background: transparent;
      align-items: flex-end;
      justify-content: flex-end;
      padding: 4px;

      .wvp-spinner {
        width: 12px;
        height: 12px;
        border-width: 2px;
      }
    }
  }

  .wvp-failed {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 0.714rem;
    color: var(--wvp-text-secondary);
    background: var(--wvp-surface);

    .wvp-retry {
      margin-top: 2px;
      padding: 1px 10px;
      font-size: 0.714rem;
      color: var(--wvp-accent);
      background: transparent;
      border: 1px solid var(--wvp-accent-soft);
      border-radius: 10px;
      cursor: pointer;
      transition:
        background-color 0.2s ease,
        color 0.2s ease;

      &:hover {
        color: #fff;
        background: var(--wvp-accent);
      }
    }
  }

  .wvp-name {
    position: relative;
    z-index: 1;
    width: 100%;
    text-align: center;
    font-size: 0.714rem;
    color: #fff;
    padding: 2px 0;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.5));
  }

  .wvp-empty {
    padding: 24px 0;
    text-align: center;
    font-size: 0.857rem;
    color: var(--wvp-text-secondary);
  }
}

@keyframes wvp-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
