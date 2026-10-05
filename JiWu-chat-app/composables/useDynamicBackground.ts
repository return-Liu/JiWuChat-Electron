import { computed, ref, watch } from "vue";
import { useSiderColor } from "../stores/siderColor";
import { extractColorFromVideo } from "../untils/colorExtractor";

/**
 * 个性装扮（动态主题）背景层。
 *
 * 提供壁纸（视频 / 图片）渲染所需的全部状态，并从视频帧吸取主色写入 store，
 * 让选中态 / 悬停态 / 主色按钮跟随壁纸配色。
 * 消息页、好友页共用，保证两个页面在动态主题下的表现一致。
 */
export const useDynamicBackground = () => {
  const siderColorStore = useSiderColor();

  const hasDynamicBackground = computed(() => siderColorStore.hasDynamicBackground);
  const chatBgType = computed(() => siderColorStore.chatBgType);
  const chatBgVideo = computed(() => siderColorStore.chatBgVideo);
  const chatBgImage = computed(() => siderColorStore.chatBgImage);
  const chatBgPoster = computed(() => siderColorStore.chatBgPoster || "");
  const chatBgOverlay = computed(() => siderColorStore.chatBgOverlay || "transparent");
  const chatBgVideoRef = ref<HTMLVideoElement | null>(null);

  /**
   * 从动态背景（视频/图片）吸取主色，写入 store，用于动态主题的选中态配色。
   * 只取一次（固定值），不随视频画面变化。
   */
  const extractDynamicAccent = () => {
    const video = chatBgVideoRef.value;
    if (!video || video.readyState < 2) return false;
    const color = extractColorFromVideo(video);
    if (color) {
      siderColorStore.setDynamicAccentColor(color);
      return true;
    }
    return false;
  };

  // 监听视频 ref：视频就绪后取色一次，之后固定不变
  watch(
    chatBgVideoRef,
    (video) => {
      if (video) {
        const doExtract = () => {
          // 视频就绪后取色一次即可（固定值）
          if (!extractDynamicAccent()) {
            // 若首次未就绪，稍后重试一次
            setTimeout(() => extractDynamicAccent(), 500);
          }
        };
        if (video.readyState >= 2) {
          doExtract();
        } else {
          video.addEventListener("loadeddata", doExtract, { once: true });
        }
      } else {
        siderColorStore.setDynamicAccentColor("");
      }
    },
    { immediate: true, flush: "post" },
  );

  // 动态背景关闭时清理
  watch(hasDynamicBackground, (has) => {
    if (!has) {
      siderColorStore.setDynamicAccentColor("");
    }
  });

  return {
    hasDynamicBackground,
    chatBgType,
    chatBgVideo,
    chatBgImage,
    chatBgPoster,
    chatBgOverlay,
    chatBgVideoRef,
  };
};
