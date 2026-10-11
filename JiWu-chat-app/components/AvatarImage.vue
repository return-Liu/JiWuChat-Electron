<template>
  <div class="avatar-image" :class="{ 'is-round': rounded }">
    <!-- 成功：真实图片 -->
    <img v-if="status === 'loaded'" :src="src" :alt="name" class="avatar-img" @error="onImgError" />

    <!-- 失败 / 无 src：首字母兜底 -->
    <div v-else-if="status === 'error'" class="avatar-fallback" :style="fallbackStyle">
      <span class="fallback-text">{{ initial }}</span>
    </div>

    <!-- 加载中：骨架占位（延迟显示，避免快速加载时闪一下） -->
    <div v-else class="avatar-skeleton"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from "vue";

interface Props {
  src?: string;
  name?: string;
  /** 是否圆形（好友 50%）；群聊传 false 使用 30% 圆角 */
  rounded?: boolean;
  /** 骨架延迟显示时间（ms），小于此值不显示骨架 */
  skeletonDelay?: number;
}

const props = withDefaults(defineProps<Props>(), {
  src: "",
  name: "",
  rounded: true,
  skeletonDelay: 100,
});

type Status = "loading" | "loaded" | "error";
const status = ref<Status>("loading");

/* 首字母：中文取第一个字，英文取首字母大写 */
const initial = computed(() => {
  const n = (props.name || "").trim();
  if (!n) return "?";
  const first = n[0];
  if (/[\u4e00-\u9fa5\u3040-\u30ff\uac00-\ud7af]/.test(first)) {
    return first;
  }
  return first.toUpperCase();
});

/* 根据名字生成稳定背景色（同一用户始终同色） */
const fallbackStyle = computed(() => {
  const n = props.name || "?";
  let hash = 0;
  for (let i = 0; i < n.length; i++) {
    hash = n.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return {
    background: `hsl(${hue}, 42%, 58%)`,
  };
});

/* 图片元素内联 error 事件 */
const onImgError = () => {
  status.value = "error";
};

/* ---------- 统一加载逻辑（合并原双 watch） ---------- */
let preloadImg: HTMLImageElement | null = null;
let skeletonTimer: ReturnType<typeof setTimeout> | null = null;

const clearTimers = () => {
  if (skeletonTimer) {
    clearTimeout(skeletonTimer);
    skeletonTimer = null;
  }
};

const loadImage = (url: string) => {
  // 无 src → 直接兜底
  if (!url) {
    clearTimers();
    status.value = "error";
    return;
  }

  // 延迟显示骨架：100ms 内加载完不显示
  clearTimers();
  status.value = "loading";
  skeletonTimer = setTimeout(() => {
    skeletonTimer = null;
  }, props.skeletonDelay);

  // 丢弃上一次未完成的预加载
  if (preloadImg) {
    preloadImg.onload = null;
    preloadImg.onerror = null;
    preloadImg = null;
  }

  const currentSrc = url; // 闭包快照，防过期回调
  const img = new Image();
  preloadImg = img;

  img.onload = () => {
    if (props.src !== currentSrc) return; // 过期请求丢弃
    clearTimers();
    status.value = "loaded";
  };
  img.onerror = () => {
    if (props.src !== currentSrc) return;
    clearTimers();
    status.value = "error";
  };
  img.src = currentSrc;
};

/* 单一 watch：src 变化时重新走加载流程 */
watch(
  () => props.src,
  (val) => loadImage(val || ""),
  { immediate: true },
);

onBeforeUnmount(() => {
  clearTimers();
  if (preloadImg) {
    preloadImg.onload = null;
    preloadImg.onerror = null;
    preloadImg = null;
  }
});
</script>

<style lang="scss" scoped>
.avatar-image {
  position: relative;
  width: 100%;
  height: 100%;
  border-radius: 30%; /* 群聊默认 */
  overflow: hidden;
  background: rgba(0, 0, 0, 0.06);

  &.is-round {
    border-radius: 50%; /* 好友 / 单聊 */
  }

  .avatar-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .avatar-skeleton {
    width: 100%;
    height: 100%;
    background: linear-gradient(
      90deg,
      rgba(0, 0, 0, 0.06) 0%,
      rgba(0, 0, 0, 0.12) 50%,
      rgba(0, 0, 0, 0.06) 100%
    );
    /* 静态占位，无动效 */
  }

  .avatar-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-weight: 600;
    user-select: none;

    /* 字号随容器缩放：46px → ~19px；32px → ~13px；80px → ~34px */
    font-size: 42%;

    .fallback-text {
      line-height: 1;
      font-size: inherit;
    }
  }
}
</style>
