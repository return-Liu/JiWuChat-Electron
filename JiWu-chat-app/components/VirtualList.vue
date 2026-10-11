<template>
  <div ref="containerRef" class="virtual-list" @scroll.passive="onScroll">
    <!-- 列表项少：直接渲染，仍复用同一滚动容器 -->
    <template v-if="items.length < minCount">
      <div
        v-for="(item, index) in items"
        :key="getKey(item, index)"
        class="virtual-list__item"
        :style="{ height: itemHeight + 'px' }"
      >
        <slot :item="item" :index="index" />
      </div>
    </template>

    <!-- 列表项多：虚拟滚动 -->
    <div v-else class="virtual-list__phantom" :style="{ height: items.length * itemHeight + 'px' }">
      <div class="virtual-list__window" :style="{ transform: 'translateY(' + offsetY + 'px)' }">
        <div
          v-for="(item, subIndex) in visibleItems"
          :key="getKey(item, startIndex + subIndex)"
          class="virtual-list__item"
          :style="{ height: itemHeight + 'px' }"
        >
          <slot :item="item" :index="startIndex + subIndex" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick } from "vue";

interface Props {
  items: any[];
  /** 每项固定高度（px） */
  itemHeight: number;
  /** 上下缓冲条数 */
  buffer?: number;
  /** 低于此数量不启用虚拟滚动 */
  minCount?: number;
  /** 唯一键字段名，默认 'id' */
  keyField?: string;
}

const props = withDefaults(defineProps<Props>(), {
  buffer: 4,
  minCount: 15,
  keyField: "id",
});

const containerRef = ref<HTMLElement | null>(null);

/* ---------- 用普通变量承载 scrollTop，避免滚动时全量响应式 ---------- */
let scrollTop = 0;
/* 触发重算用的版本号 */
const scrollTick = ref(0);

/* 容器高度：只读，不写回 DOM */
const containerHeight = ref(0);

/* ---------- 可见范围计算 ---------- */
const startIndex = computed(() => {
  // 依赖 scrollTick 触发重算，但实际读的是 scrollTop 变量
  void scrollTick.value;
  const start = Math.floor(scrollTop / props.itemHeight) - props.buffer;
  return Math.max(0, start);
});

const endIndex = computed(() => {
  const visibleCount = Math.ceil(containerHeight.value / props.itemHeight);
  const end = startIndex.value + visibleCount + props.buffer * 2;
  return Math.min(props.items.length, end);
});

const visibleItems = computed(() => props.items.slice(startIndex.value, endIndex.value));

const offsetY = computed(() => startIndex.value * props.itemHeight);

/* ---------- key：用原始索引 ---------- */
const getKey = (item: any, originalIndex: number): string => {
  const id = item?.[props.keyField];
  return id != null ? String(id) : `idx-${originalIndex}`;
};

/* ---------- 滚动：rAF 节流，避免高频重渲染 ---------- */
let rafId: number | null = null;

const onScroll = () => {
  if (!containerRef.value) return;
  const top = containerRef.value.scrollTop;

  // 节流：同一帧内多次滚动只处理一次
  if (rafId != null) return;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    scrollTop = top;
    scrollTick.value++;
  });
};

/* ---------- 测量容器高度 ---------- */
let resizeObserver: ResizeObserver | null = null;

const measure = () => {
  if (containerRef.value) {
    containerHeight.value = containerRef.value.clientHeight;
  }
};

onMounted(async () => {
  await nextTick();
  measure();

  // 同步一次 scrollTop（父级若有初始滚动）
  if (containerRef.value) {
    scrollTop = containerRef.value.scrollTop;
  }

  if (containerRef.value && typeof ResizeObserver !== "undefined") {
    resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(containerRef.value);
  }
});

onBeforeUnmount(() => {
  if (rafId != null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  resizeObserver?.disconnect();
  resizeObserver = null;
});
</script>

<style lang="scss" scoped>
.virtual-list {
  position: relative;
  overflow-y: auto;
  height: 100%;
  width: 100%;
  /* 让滚动更顺滑（可选） */
  -webkit-overflow-scrolling: touch;

  &__phantom {
    position: relative;
    width: 100%;
  }

  &__window {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    /* will-change 由 class 切换控制，见下方 */
  }

  &__item {
    width: 100%;
    box-sizing: border-box;
  }
}
</style>
