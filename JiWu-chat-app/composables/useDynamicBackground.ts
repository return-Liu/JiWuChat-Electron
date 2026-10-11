import { computed } from "vue";
import { useSiderColor } from "../stores/siderColor";

/**
 * 个性装扮（动态主题）背景层。
 *
 * 本文件只是**薄封装**：所有状态与取色逻辑都在 `siderColor` store 里（唯一实现）。
 * 历史上这里自己持有 video ref、token、缓存并注册取色 watch，
 * 导致页面与组件各持一份、取色重复且互相覆盖；现在只做读与转发。
 *
 * 消息页、好友页共用，保证两个页面在动态主题下的表现一致。
 */
export const useDynamicBackground = () => {
  const siderColorStore = useSiderColor();

  /** 供 <DynamicBackground> 用 `:ref` 注册视频元素 */
  const registerVideoEl = (el: unknown) => {
    siderColorStore.registerDynamicBgVideo((el as HTMLVideoElement) ?? null);
  };

  return {
    hasDynamicBackground: computed(() => siderColorStore.hasDynamicBackground),
    chatBgType: computed(() => siderColorStore.chatBgType),
    chatBgVideo: computed(() => siderColorStore.chatBgVideo),
    chatBgImage: computed(() => siderColorStore.chatBgImage),
    chatBgPoster: computed(() => siderColorStore.chatBgPoster || ""),
    chatBgOverlay: computed(() => siderColorStore.chatBgOverlay || "transparent"),
    registerVideoEl,
    pauseVideo: () => siderColorStore.pauseDynamicBgVideo(),
    resumeVideo: () => siderColorStore.resumeDynamicBgVideo(),
  };
};
