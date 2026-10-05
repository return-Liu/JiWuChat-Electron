import { computed, onBeforeUnmount, ref, watch, type Ref } from "vue";

/**
 * 等尺寸网格虚拟滚动。
 *
 * 只渲染可视区域内的卡片（含上下缓冲区），用于壁纸数量较多时避免一次性
 * 创建大量 video / img 节点导致内存与解码压力。
 * 依赖条件：每一项尺寸固定（itemWidth × itemHeight），间距固定（gap）。
 *
 * 布局计算抽为纯函数 {@link computeGridLayout}，便于单元测试与复用。
 */
export interface VirtualGridOptions {
  /** 数据总条数 */
  count: Ref<number>;
  /** 滚动容器元素 */
  containerRef: Ref<HTMLElement | null>;
  /** 单项宽度（px） */
  itemWidth: number;
  /** 单项高度（px） */
  itemHeight: number;
  /** 间距（px），默认 12 */
  gap?: number;
  /** 上下缓冲行数，默认 1 */
  overscan?: number;
  /** 拉伸卡片填满整行（保持宽高比），消除行尾右侧空白，默认 false */
  fillWidth?: boolean;
  /** 拉伸模式下卡片的最大宽度（px），防止窄容器单列时被过度拉伸，默认不限制 */
  maxItemWidth?: number;
}

export interface VirtualGridItem {
  index: number;
  row: number;
  col: number;
}

export interface GridLayoutInput {
  /** 数据总条数 */
  count: number;
  /** 可视区宽（内容盒，不含 padding / 滚动条） */
  viewportWidth: number;
  /** 可视区高（内容盒） */
  viewportHeight: number;
  /** 当前滚动位置 */
  scrollTop: number;
  itemWidth: number;
  itemHeight: number;
  gap: number;
  overscan: number;
  /**
   * 拉伸模式：按 itemWidth 定列数后，把整行剩余宽度均摊给每张卡片
   * （保持宽高比），消除行尾右侧的大片空白。
   */
  fillWidth?: boolean;
  /** 拉伸模式下卡片的最大宽度（px），防止窄容器单列时被过度拉伸 */
  maxItemWidth?: number;
}

export interface GridLayout {
  columns: number;
  rowUnit: number;
  rowHeight: number;
  totalRows: number;
  /** 撑起滚动高度的占位高度 */
  totalHeight: number;
  startRow: number;
  endRow: number;
  visibleItems: VirtualGridItem[];
  /** 实际渲染的单项尺寸（fillWidth 时为拉伸后的值，其余情况等于入参） */
  itemWidth: number;
  itemHeight: number;
}

/**
 * 纯函数：由视口尺寸与滚动位置推导网格布局。
 * 不依赖 DOM，可直接在单元测试中使用。
 */
export function computeGridLayout(input: GridLayoutInput): GridLayout {
  const {
    count,
    viewportWidth,
    viewportHeight,
    scrollTop,
    itemWidth,
    itemHeight,
    gap,
    overscan,
    fillWidth,
    maxItemWidth,
  } = input;

  const minRowUnit = itemWidth + gap;

  // 视口尚未测量（width 为 0，例如容器被 v-show 隐藏）时退回单列，避免除零 / 负列数
  const columns = viewportWidth > 0 ? Math.max(1, Math.floor((viewportWidth + gap) / minRowUnit)) : 1;

  // fillWidth：先按最小宽度定列数，再把整行剩余宽度均摊给每张卡片（保持宽高比）。
  // 由列数公式可证 columns * itemWidth + (columns - 1) * gap <= viewportWidth，
  // 因此拉伸后的宽度只会 >= itemWidth，不会把卡片压扁。
  let cellWidth = itemWidth;
  let cellHeight = itemHeight;
  if (fillWidth && viewportWidth > 0) {
    cellWidth = (viewportWidth - (columns - 1) * gap) / columns;
    // 窄容器（如设置侧栏收窄到单列）时 cellWidth 会撑满视口，导致卡片异常放大，
    // 这里按 maxItemWidth 封顶，仍保持宽高比，仅行尾留白而非把卡片拉变形。
    if (maxItemWidth && cellWidth > maxItemWidth) cellWidth = maxItemWidth;
    cellHeight = itemWidth > 0 ? (cellWidth / itemWidth) * itemHeight : itemHeight;
  }

  const rowUnit = cellWidth + gap;
  const rowHeight = cellHeight + gap;
  const totalRows = columns > 0 ? Math.ceil(count / columns) : 0;
  // 最后一行不补底部间距
  const totalHeight = totalRows > 0 ? totalRows * rowHeight - gap : 0;

  const startRow = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endRow = Math.min(
    totalRows,
    Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan,
  );

  const visibleItems: VirtualGridItem[] = [];
  for (let row = startRow; row < endRow; row++) {
    for (let col = 0; col < columns; col++) {
      const index = row * columns + col;
      if (index < count) visibleItems.push({ index, row, col });
    }
  }

  return {
    columns,
    rowUnit,
    rowHeight,
    totalRows,
    totalHeight,
    startRow,
    endRow,
    visibleItems,
    itemWidth: cellWidth,
    itemHeight: cellHeight,
  };
}

export const useVirtualGrid = (options: VirtualGridOptions) => {
  const {
    count,
    containerRef,
    itemWidth,
    itemHeight,
    gap = 12,
    overscan = 1,
    fillWidth = false,
    maxItemWidth,
  } = options;

  const scrollTop = ref(0);
  const viewportWidth = ref(0);
  const viewportHeight = ref(0);

  const layout = computed(() =>
    computeGridLayout({
      count: count.value,
      viewportWidth: viewportWidth.value,
      viewportHeight: viewportHeight.value,
      scrollTop: scrollTop.value,
      itemWidth,
      itemHeight,
      gap,
      overscan,
      fillWidth,
      maxItemWidth,
    }),
  );

  const columns = computed(() => layout.value.columns);
  const rowHeight = computed(() => layout.value.rowHeight);
  const totalRows = computed(() => layout.value.totalRows);
  const totalHeight = computed(() => layout.value.totalHeight);
  const visibleItems = computed(() => layout.value.visibleItems);
  /** 实际渲染尺寸（fillWidth 下随容器宽度自适应），供 CSS 变量同步使用 */
  const cardWidth = computed(() => layout.value.itemWidth);
  const cardHeight = computed(() => layout.value.itemHeight);

  const itemStyle = ({ row, col }: VirtualGridItem) => ({
    transform: `translate3d(${col * layout.value.rowUnit}px, ${row * rowHeight.value}px, 0)`,
  });

  const readScroll = () => {
    scrollTop.value = containerRef.value?.scrollTop ?? 0;
  };

  /** 写入内容盒尺寸（不含 padding，避免最后一列被 overflow 裁掉） */
  const applySize = (width: number, height: number) => {
    viewportWidth.value = Math.max(0, width);
    viewportHeight.value = Math.max(0, height);
    readScroll();
  };

  /** 兜底测量：从元素计算样式中扣除左右 / 上下内边距 */
  const measureFromElement = () => {
    const el = containerRef.value;
    if (!el) return;

    let paddingX = 0;
    let paddingY = 0;
    if (typeof getComputedStyle === "function") {
      const style = getComputedStyle(el);
      paddingX = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      paddingY = (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
    }
    applySize(el.clientWidth - paddingX, el.clientHeight - paddingY);
  };

  let observer: ResizeObserver | null = null;
  let observedEl: HTMLElement | null = null;

  const detach = () => {
    if (observedEl) observedEl.removeEventListener("scroll", readScroll);
    if (observer && observedEl) observer.unobserve(observedEl);
    observer = null;
    observedEl = null;
  };

  const attach = () => {
    detach();
    const el = containerRef.value;
    if (!el || typeof ResizeObserver === "undefined") {
      measureFromElement();
      return;
    }
    observedEl = el;
    el.addEventListener("scroll", readScroll, { passive: true });
    observer = new ResizeObserver((entries) => {
      // contentRect 即内容盒，天然排除 padding 与滚动条
      const rect = entries[0]?.contentRect;
      if (rect) applySize(rect.width, rect.height);
      else measureFromElement();
    });
    observer.observe(el);
    measureFromElement();
  };

  watch(containerRef, attach, { immediate: true, flush: "post" });
  watch(count, () => readScroll());

  onBeforeUnmount(detach);

  return {
    columns,
    rowHeight,
    totalRows,
    totalHeight,
    visibleItems,
    cardWidth,
    cardHeight,
    itemStyle,
    measure: measureFromElement,
    onScroll: readScroll,
  };
};
