/**
 * 个性装扮（壁纸）卡片 —— 布局与样式的唯一数据源。
 *
 * 组件模板、虚拟滚动计算、CSS 变量统一从这里取值，避免「JS 算一套、CSS 写一套」
 * 造成的错位；主题色也集中在此并指向全局主题变量，日/夜间模式切换无需改动组件。
 */

/** 卡片布局常量（同时驱动虚拟滚动计算与 CSS） */
export const WALLPAPER_CARD = {
  /** 卡片宽度（px） */
  width: 140,
  /** 卡片高度（px） */
  height: 90,
  /** 卡片间距（px） */
  gap: 12,
  /** 卡片圆角（px） */
  radius: 6,
  /** 虚拟滚动上下缓冲行数（移除 IntersectionObserver 后，用缓冲行承担预加载） */
  overscanRows: 2,
  /** 滚动视口高度（px），超出后容器内部滚动 */
  viewportHeight: 280,
} as const;

/**
 * 主题相关样式变量：统一引用全局主题变量（带兜底值），
 * 主题切换时只需维护这里的一处映射。
 */
export const WALLPAPER_THEME_VARS: Record<string, string> = {
  /** 选中态 / 播放中的强调色 */
  "--wvp-accent": "var(--purple-color, #8b5cf6)",
  /** 悬停态的柔和强调色 */
  "--wvp-accent-soft": "rgba(139, 92, 246, 0.6)",
  /** 卡片占位底色 */
  "--wvp-surface": "var(--bg-tertiary, rgba(0, 0, 0, 0.04))",
  /** 骨架屏底色 */
  "--wvp-skeleton-bg": "var(--bg-tertiary, rgba(0, 0, 0, 0.06))",
  /** 描边 / 转圈底色 */
  "--wvp-border": "var(--border-color, rgba(0, 0, 0, 0.15))",
  /** 次要文本色（失败提示等） */
  "--wvp-text-secondary": "var(--text-secondary, #64748b)",
};

export interface WallpaperVarsOptions {
  width?: number;
  height?: number;
  gap?: number;
  radius?: number;
  viewportHeight?: number;
}

/**
 * 生成壁纸卡片的 CSS 变量集合。
 * 不传参时使用默认布局，传参可在不同场景（如大图预览）复用同一套样式。
 */
export const buildWallpaperVars = (options: WallpaperVarsOptions = {}): Record<string, string> => {
  const {
    width = WALLPAPER_CARD.width,
    height = WALLPAPER_CARD.height,
    gap = WALLPAPER_CARD.gap,
    radius = WALLPAPER_CARD.radius,
    viewportHeight = WALLPAPER_CARD.viewportHeight,
  } = options;

  return {
    "--wvp-card-width": `${width}px`,
    "--wvp-card-height": `${height}px`,
    "--wvp-card-gap": `${gap}px`,
    "--wvp-card-radius": `${radius}px`,
    "--wvp-viewport-height": `${viewportHeight}px`,
    ...WALLPAPER_THEME_VARS,
  };
};
