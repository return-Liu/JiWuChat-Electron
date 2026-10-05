// ============================================================
// 主题类型定义
// ============================================================
export type ThemeType = "base" | "dynamic" | "system" | "custom";
export type SystemThemeVariant = "light" | "dark" | "auto";

export interface ColorPalette {
  name: string;
  color: string;
  hover: string;
  active: string;
  light: string;
  text: string;
  bubbleBg: string;
  /** 新增：气泡边框，用于提升气泡边界可见度 */
  bubbleBorder?: string;

  sidebarBg: string;
  sidebarText: string;
  sidebarIcon: string;
  sidebarShadow?: string;
  sidebarBorder?: string;

  sidebarHoverBg?: string;
  sidebarActiveBg?: string;

  chatBgGradient: string;
  chatBgStart: string;
  chatBgMiddle?: string;
  chatBgEnd: string;

  chatBgType: "static" | "animated" | "image" | "video";
  chatBgAnimation: string;
  chatBgPattern: string;
  chatBgOpacity: number;

  /** 动态背景：图片 URL（chatBgType === "image" 时生效） */
  chatBgImage?: string;
  /** 动态背景：视频 URL（chatBgType === "video" 时生效） */
  chatBgVideo?: string;
  /** 动态背景：视频封面图 URL（视频加载前/失败时显示） */
  chatBgPoster?: string;
  /** 动态背景叠加层颜色（用于保证文字可读性，如 rgba(0,0,0,0.3)） */
  chatBgOverlay?: string;

  glassmorphism?: boolean;
  blurAmount?: number;
  shadowIntensity?: number;
  borderGlow?: string;
  texture?: string;
  gradientAngle?: number;
  saturation?: number;
  brightness?: number;

  contactItemBg?: string;
  contactItemHover?: string;
  contactItemActive?: string;

  textPrimary?: string;
  textSecondary?: string;
  bgPrimary?: string;
  borderLight?: string;
  borderNormal?: string;
  bgTertiary?: string;
  tagBg?: string;
  tagColor?: string;
  linkColor?: string;
  dangerColor?: string;
  highlightBg?: string;
  highlightColor?: string;
  selectedBg?: string;
  primaryLight?: string;
  scrollbarTrack?: string;
  scrollbarThumb?: string;

  dividerLineColor: string;
  dividerLineWidth?: string;
  dividerLineStyle?: string;
  dividerLineShadow?: string;
  dividerTextColor: string;
  dividerSpacing?: string;

  bubbleShadow?: string;
  fileIconBg?: string;
  videoPlayBtnBg?: string;
  multiSelectBorder?: string;
  badgeHoverBg?: string;
  loadingTextColor?: string;
  recalledBg?: string;
  joinNoticeBg?: string;
}
