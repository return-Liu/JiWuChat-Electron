<template>
  <!--
    个性装扮：动态背景层（视频 / 图片壁纸，铺满所在页面）。
    各页面曾各自复制一份 video / img 模板，这里统一收敛；
    取色与状态全部来自 useDynamicBackground（单例），页面不再重复实现。
  -->
  <div v-if="hasDynamicBackground" class="dynamic-bg-layer">
    <video
      v-if="chatBgType === 'video' && chatBgVideo"
      :ref="registerVideoEl"
      class="dynamic-bg-media"
      :src="encodeURI(chatBgVideo)"
      :poster="chatBgPoster"
      muted
      loop
      autoplay
      playsinline
      preload="auto"
    ></video>
    <img
      v-else-if="chatBgType === 'image' && chatBgImage"
      class="dynamic-bg-media"
      :src="chatBgImage"
      alt=""
    />
    <div class="dynamic-bg-overlay" :style="{ background: chatBgOverlay }"></div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { useDynamicBackground } from "../composables/useDynamicBackground";

const {
  hasDynamicBackground,
  chatBgType,
  chatBgVideo,
  chatBgImage,
  chatBgPoster,
  chatBgOverlay,
  registerVideoEl,
  pauseVideo,
  resumeVideo,
} = useDynamicBackground();

// 窗口切到后台 / 组件卸载时暂停视频：避免壁纸视频在后台常驻解码、白耗 CPU 和电量
const handleVisibilityChange = () => {
  if (document.hidden) {
    pauseVideo();
  } else {
    resumeVideo();
  }
};

onMounted(() => {
  document.addEventListener("visibilitychange", handleVisibilityChange);
});

onUnmounted(() => {
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  pauseVideo();
});
</script>

<style scoped>
/* 独立合成层 + 硬件加速；不使用 contain: strict / will-change，
   避免视频循环时合成层重建导致闪动 */
.dynamic-bg-layer {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  transform: translateZ(0);
}

.dynamic-bg-media {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  user-select: none;
  transform: translateZ(0);
  backface-visibility: hidden;
}

.dynamic-bg-overlay {
  position: absolute;
  inset: 0;
  z-index: 1;
}
</style>
