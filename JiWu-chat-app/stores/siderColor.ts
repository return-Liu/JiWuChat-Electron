import { defineStore } from "pinia";
import { ref, computed, readonly } from "vue";
import {
  broadcastThemeSettings,
  onThemeSettingsChanged,
} from "../untils/electronHelper";
import type { ThemeType, SystemThemeVariant, ColorPalette } from "./theme/types";
import {
  isClient,
  safeGetStorage,
  safeSetStorage,
  readCSSVar,
  hexToRgb,
  hexToRgba,
  isLightColor,
  darkenColor,
  createUnifiedGradient,
  createSidebarShadow,
} from "./theme/utils";

// 保持类型 re-export，兼容可能存在的跨文件引用
export type { ThemeType, SystemThemeVariant, ColorPalette } from "./theme/types";

// ============================================================
// 由 CSS 变量构建调色板（system 主题用）
// ============================================================
const buildDarkPaletteFromCSSVars = (): ColorPalette => {
  return {
    name: "夜间模式",
    color: "#8b5cf6",
    hover: "#7c3aed",
    active: "#6d28d9",
    light: "rgba(139, 92, 246, 0.12)",
    text: "#e5e5e5",
    bubbleBg: "#1a1a1a",
    bubbleBorder: "1px solid #333333",

    sidebarBg: "#141414",
    sidebarText: "#e5e5e5",
    sidebarIcon: "#999999",
    sidebarShadow: "none",
    sidebarBorder: "1px solid #2a2a2a",

    sidebarHoverBg: "#262626",
    sidebarActiveBg: "#1f1f1f",

    chatBgGradient:
      "linear-gradient(135deg, #0d0d0d 0%, #141414 50%, #0d0d0d 100%)",
    chatBgStart: "#0d0d0d",
    chatBgMiddle: "#141414",
    chatBgEnd: "#0d0d0d",
    chatBgType: "static" as const,
    chatBgAnimation: "",
    chatBgPattern: "",
    chatBgOpacity: 1,

    glassmorphism: false,
    blurAmount: 12,
    shadowIntensity: 0.3,
    borderGlow: "#2a2a2a",
    texture: "matte",
    gradientAngle: 135,
    saturation: 0.3,
    brightness: 0.95,

    textPrimary: "#e5e5e5",
    textSecondary: "#999999",
    bgPrimary: "#1a1a1a",
    borderLight: "#2a2a2a",
    borderNormal: "#2a2a2a",
    bgTertiary: "#1f1f1f",
    tagBg: "rgba(139, 92, 246, 0.12)",
    tagColor: "#8b5cf6",
    linkColor: "#8b5cf6",
    dangerColor: "#ef4444",
    highlightBg: "rgba(251, 191, 36, 0.12)",
    highlightColor: "#f59e0b",
    selectedBg: "rgba(139, 92, 246, 0.08)",
    primaryLight: "rgba(139, 92, 246, 0.08)",
    scrollbarTrack: "#141414",
    scrollbarThumb: "#404040",

    contactItemBg: "#1f1f1f",
    contactItemHover: "#262626",
    contactItemActive: "#1f1f1f",

    dividerLineColor: "#2a2a2a",
    dividerLineWidth: "1px",
    dividerLineStyle: "solid",
    dividerLineShadow: "none",
    dividerTextColor: "#666666",
    dividerSpacing: "10px",

    // ✅ 无阴影
    bubbleShadow: "none",
  };
};

const buildLightPaletteFromCSSVars = (): ColorPalette => {
  return {
    name: "日间模式",
    color: readCSSVar("--color-brand") || "#94A3B8",
    hover: readCSSVar("--color-brand-hover") || "#64748B",
    active: readCSSVar("--color-brand-hover") || "#64748B",
    light: readCSSVar("--color-brand-light") || "rgba(148,163,184,0.12)",
    text: readCSSVar("--text-primary") || "#0F172A",
    bubbleBg: readCSSVar("--card-bg") || "#FFFFFF",
    bubbleBorder: `1px solid ${readCSSVar("--border-color") || "#E2E8F0"}`,

    sidebarBg: readCSSVar("--bg-secondary") || "#FFFFFF",
    sidebarText: readCSSVar("--text-primary") || "#0F172A",
    sidebarIcon: readCSSVar("--text-secondary") || "#64748B",
    sidebarShadow: "2px 0 16px rgba(0, 0, 0, 0.06)",
    sidebarBorder: `1px solid ${readCSSVar("--border-color") || "#E2E8F0"}`,

    sidebarHoverBg: readCSSVar("--bg-hover") || "#F1F5F9",
    sidebarActiveBg: readCSSVar("--bg-tertiary") || "#E2E8F0",

    chatBgGradient: `linear-gradient(135deg, ${readCSSVar("--bg-primary") || "#FFFFFF"} 0%, ${readCSSVar("--bg-secondary") || "#F8FAFC"} 50%, ${readCSSVar("--bg-primary") || "#FFFFFF"} 100%)`,
    chatBgStart: readCSSVar("--bg-primary") || "#FFFFFF",
    chatBgMiddle: readCSSVar("--bg-secondary") || "#F8FAFC",
    chatBgEnd: readCSSVar("--bg-primary") || "#FFFFFF",
    chatBgType: "static" as const,
    chatBgAnimation: "",
    chatBgPattern: "",
    chatBgOpacity: 1,

    glassmorphism: false,
    blurAmount: 16,
    shadowIntensity: 0.06,
    borderGlow: readCSSVar("--border-color") || "#E2E8F0",
    texture: "smooth",
    gradientAngle: 135,
    saturation: 0.85,
    brightness: 1.05,

    textPrimary: readCSSVar("--text-primary") || "#0F172A",
    textSecondary: readCSSVar("--text-secondary") || "#64748B",
    bgPrimary: readCSSVar("--card-bg") || "#FFFFFF",
    borderLight: readCSSVar("--border-color") || "rgba(0,0,0,0.04)",
    borderNormal: readCSSVar("--border-color") || "#E2E8F0",
    bgTertiary: readCSSVar("--bg-tertiary") || "rgba(0,0,0,0.015)",
    tagBg: readCSSVar("--color-brand-light") || "rgba(148,163,184,0.08)",
    tagColor: readCSSVar("--color-brand") || "#94A3B8",
    linkColor: readCSSVar("--color-brand") || "#94A3B8",
    dangerColor: readCSSVar("--error-color") || "#EF4444",
    highlightBg: readCSSVar("--warning-bg") || "rgba(251,191,36,0.12)",
    highlightColor: readCSSVar("--warning-color") || "#D97706",
    selectedBg: readCSSVar("--color-brand-light") || "rgba(148,163,184,0.08)",
    primaryLight: readCSSVar("--color-brand-light") || "rgba(148,163,184,0.06)",
    scrollbarTrack: readCSSVar("--bg-secondary") || "rgba(0,0,0,0.015)",
    scrollbarThumb: readCSSVar("--text-tertiary") || "rgba(0,0,0,0.1)",

    contactItemBg: readCSSVar("--bg-tertiary") || "rgba(0,0,0,0.015)",
    contactItemHover: readCSSVar("--bg-hover") || "#F1F5F9",
    contactItemActive: readCSSVar("--bg-tertiary") || "#E2E8F0",

    dividerLineColor: readCSSVar("--border-color") || "#E2E8F0",
    dividerLineWidth: "1.5px",
    dividerLineStyle: "solid",
    dividerLineShadow: "0 1px 2px rgba(0, 0, 0, 0.06)",
    dividerTextColor: readCSSVar("--text-tertiary") || "#94A3B8",
    dividerSpacing: "10px",

    // ✅ 无阴影
    bubbleShadow: "none",
  };
};

const DEFAULT_THEME_TYPE: ThemeType = "base";
const DEFAULT_PALETTE_INDEX = 0;
const DEFAULT_COLOR = "#94A3B8";
const DEFAULT_TEXT_SECONDARY = "#64748B";
const DEFAULT_BORDER_LIGHT = "rgba(0, 0, 0, 0.04)";
const DEFAULT_BORDER_NORMAL = "#E2E8F0";
const DEFAULT_BG_TERTIARY = "rgba(0, 0, 0, 0.015)";
const DEFAULT_DANGER_COLOR = "#EF4444";
const DEFAULT_HIGHLIGHT_BG = "rgba(251, 191, 36, 0.12)";
const DEFAULT_HIGHLIGHT_COLOR = "#D97706";
const DEFAULT_SCROLLBAR_TRACK = "rgba(0, 0, 0, 0.015)";
const DEFAULT_SCROLLBAR_THUMB = "rgba(0, 0, 0, 0.1)";

// ============================================================
// 基础调色板：日间模式默认配色（个性装扮在此基础上替换聊天背景）
// ============================================================
const BASE_LIGHT_PALETTE: ColorPalette = {
  name: "极简白",
  color: "#DCDCDC",
  hover: "#E8E8E8",
  active: "#C8C8C8",
  light: "rgba(200, 200, 200, 0.10)",
  text: "#111111",
  // ✅ 气泡：纯白实色 + 极浅描边，无阴影
  bubbleBg: "#FFFFFF",
  bubbleBorder: "1px solid rgba(0, 0, 0, 0.06)",

  sidebarBg: "#FAFAFA",
  sidebarText: "#1A1A1A",
  sidebarIcon: "#D0D0D0",
  sidebarShadow: createSidebarShadow("#DCDCDC", 0.03),
  sidebarBorder: "1px solid rgba(220, 220, 220, 0.05)",

  sidebarHoverBg: "#F0F0F0",
  sidebarActiveBg: "#E8E8E8",

  chatBgGradient: createUnifiedGradient(
    ["#FEFEFE", "#FBFBFB", "#F8F8F8", "#FBFBFB", "#FEFEFE"],
    120,
  ),
  chatBgStart: "#FEFEFE",
  chatBgMiddle: "#F8F8F8",
  chatBgEnd: "#FBFBFB",
  chatBgType: "static" as const,
  chatBgAnimation: "",
  chatBgPattern: "",
  chatBgOpacity: 1,

  glassmorphism: true,
  blurAmount: 12,
  shadowIntensity: 0.03,
  borderGlow: "rgba(220, 220, 220, 0.06)",
  texture: "matte",
  gradientAngle: 120,
  saturation: 0.2,
  brightness: 1.02,

  textPrimary: "#1A1A1A",
  textSecondary: "#999999",
  bgPrimary: "rgba(255, 255, 255, 0.3)",
  borderLight: "rgba(220, 220, 220, 0.04)",
  borderNormal: "rgba(230, 230, 230, 0.4)",
  bgTertiary: "rgba(220, 220, 220, 0.02)",
  tagBg: "rgba(220, 220, 220, 0.05)",
  tagColor: "#999999",
  linkColor: "#999999",
  dangerColor: "#E06060",
  highlightBg: "rgba(251, 191, 36, 0.08)",
  highlightColor: "#D4880F",
  selectedBg: "rgba(200, 200, 200, 0.14)",
  primaryLight: "rgba(220, 220, 220, 0.05)",
  scrollbarTrack: "rgba(220, 220, 220, 0.02)",
  scrollbarThumb: "rgba(200, 200, 200, 0.10)",

  contactItemBg: "rgba(255, 255, 255, 0.6)",
  contactItemHover: "#F0F0F0",
  contactItemActive: "#E8E8E8",

  dividerLineColor: "#ebe1e1",
  dividerLineWidth: "1px",
  dividerLineStyle: "solid",
  dividerLineShadow: "none",
  dividerTextColor: "#B0B0B0",
  dividerSpacing: "10px",

  // ✅ 无阴影
  bubbleShadow: "none",
};

// ============================================================
// 个性装扮 —— 默认使用 public/theme 下的本地视频壁纸
// ============================================================
const DEFAULT_LIGHT_PALETTE: ColorPalette = BASE_LIGHT_PALETTE;

// 壁纸列表由 scripts/generate-wallpapers.js 自动生成
export type { DynamicWallpaper } from "./dynamicWallpapers.generated";
export { DYNAMIC_WALLPAPERS } from "./dynamicWallpapers.generated";
import { DYNAMIC_WALLPAPERS } from "./dynamicWallpapers.generated";

/** 默认个性装扮壁纸路径（兼容旧引用） */
const DEFAULT_DYNAMIC_URL = DYNAMIC_WALLPAPERS[0].url;

/** 索引夹取（模块级） */
function clampIndexRaw(idx: number | undefined, len: number): number {
  if (typeof idx !== "number" || Number.isNaN(idx) || len <= 0) return 0;
  return Math.max(0, Math.min(idx, len - 1));
}

/**
 * 生成个性装扮调色板 —— 复用默认主题配色，仅替换背景为视频/图片
 * @param index 壁纸索引（对应 DYNAMIC_WALLPAPERS）
 */
const buildDynamicPalette = (index: number = 0): ColorPalette => {
  const wallpaper =
    DYNAMIC_WALLPAPERS[clampIndexRaw(index, DYNAMIC_WALLPAPERS.length)] ??
    DYNAMIC_WALLPAPERS[0];
  return {
    ...DEFAULT_LIGHT_PALETTE,
    name: `个性装扮 · ${wallpaper.name}`,
    chatBgType: wallpaper.type,
    chatBgAnimation: "",
    chatBgPattern: "",
    chatBgVideo: wallpaper.type === "video" ? wallpaper.url : undefined,
    chatBgImage: wallpaper.type === "image" ? wallpaper.url : undefined,
    // 封面：视频用抽帧生成的 poster，图片用自身；缺省时空串，前端退化为透明
    chatBgPoster: wallpaper.type === "video" ? (wallpaper.poster || "") : wallpaper.url,
    chatBgOverlay: "transparent",
  };
};

// ============================================================
// 🔥 核心修复：由日间调色板生成暗色调色板
// ============================================================
const buildDarkPaletteFromLight = (light: ColorPalette): ColorPalette => {
  const themeColor = light?.color || "#8b5cf6";

  const darkBubbleBg = darkenColor(light.bubbleBg || "#FFFFFF", 0.12);
  const bubbleTextColor = isLightColor(darkBubbleBg) ? "#1a1a1a" : "#e5e5e5";

  return {
    ...light,
    name: `${light.name} 夜间`,
    color: themeColor,
    hover: darkenColor(themeColor, 0.7),
    active: darkenColor(themeColor, 0.55),
    light: `rgba(${hexToRgb(themeColor)}, 0.12)`,
    text: bubbleTextColor,

    sidebarBg: darkenColor(light.sidebarBg || "#FAFAFA", 0.08),
    sidebarText: "#e5e5e5",
    sidebarIcon: darkenColor(light.sidebarIcon || "#D0D0D0", 0.55),
    sidebarShadow: "none",
    sidebarBorder: "1px solid #2a2a2a",

    sidebarHoverBg: darkenColor(
      light.sidebarHoverBg || light.sidebarActiveBg || "#F0F0F0",
      0.16,
    ),
    sidebarActiveBg: darkenColor(
      light.sidebarActiveBg || light.sidebarHoverBg || "#E8E8E8",
      0.12,
    ),

    chatBgGradient: `linear-gradient(135deg, ${darkenColor(
      light.chatBgStart || "#FEFEFE",
      0.06,
    )} 0%, ${darkenColor(
      light.chatBgMiddle || light.chatBgStart || "#F8F8F8",
      0.08,
    )} 50%, ${darkenColor(light.chatBgStart || "#FEFEFE", 0.06)} 100%)`,
    chatBgStart: darkenColor(light.chatBgStart || "#FEFEFE", 0.06),
    chatBgMiddle: darkenColor(
      light.chatBgMiddle || light.chatBgStart || "#F8F8F8",
      0.08,
    ),
    chatBgEnd: darkenColor(light.chatBgEnd || light.chatBgStart || "#FBFBFB", 0.06),
    chatBgType: light.chatBgType ?? "static",
    chatBgAnimation: light.chatBgAnimation || "",
    chatBgPattern: light.chatBgPattern || "",
    chatBgOpacity: light.chatBgOpacity ?? 1,
    chatBgImage: light.chatBgImage,
    chatBgVideo: light.chatBgVideo,
    chatBgPoster: light.chatBgPoster,
    chatBgOverlay: light.chatBgOverlay,

    glassmorphism: false,
    blurAmount: 12,
    shadowIntensity: 0.3,
    borderGlow: "#2a2a2a",
    texture: "matte",
    gradientAngle: 135,
    saturation: 0.3,
    brightness: 0.95,

    textPrimary: "#e5e5e5",
    textSecondary: "#999999",
    bgPrimary: darkenColor(light.bgPrimary || "#FFFFFF", 0.10),
    borderLight: "#2a2a2a",
    borderNormal: "#2a2a2a",
    bgTertiary: darkenColor(light.bgTertiary || "#FEFEFE", 0.10),
    tagBg: `rgba(${hexToRgb(themeColor)}, 0.12)`,
    tagColor: themeColor,
    linkColor: themeColor,
    dangerColor: "#ef4444",
    highlightBg: "rgba(251, 191, 36, 0.12)",
    highlightColor: "#f59e0b",
    selectedBg: `rgba(${hexToRgb(themeColor)}, 0.08)`,
    primaryLight: `rgba(${hexToRgb(themeColor)}, 0.08)`,
    scrollbarTrack: darkenColor(light.scrollbarTrack || "#FAFAFA", 0.08),
    scrollbarThumb: "#404040",

    contactItemBg: darkenColor(
      light.contactItemBg || light.sidebarActiveBg || "#E8E8E8",
      0.12,
    ),
    contactItemHover: darkenColor(
      light.contactItemHover || light.sidebarHoverBg || "#F0F0F0",
      0.16,
    ),
    contactItemActive: darkenColor(
      light.contactItemActive || light.sidebarActiveBg || "#E8E8E8",
      0.12,
    ),

    dividerLineColor: "#2a2a2a",
    dividerLineWidth: "1px",
    dividerLineStyle: "solid",
    dividerLineShadow: "none",
    dividerTextColor: "#666666",
    dividerSpacing: "10px",

    bubbleBg: darkBubbleBg,
    // ✅ 夜间气泡边框：浅白描边，避免和背景糊在一起
    bubbleBorder: "1px solid rgba(255, 255, 255, 0.08)",
    // ✅ 无阴影
    bubbleShadow: "none",

    fileIconBg: darkenColor(light.fileIconBg || light.bgTertiary || "#FEFEFE", 0.10),
    videoPlayBtnBg: "rgba(0, 0, 0, 0.6)",
    multiSelectBorder: themeColor,
    badgeHoverBg: darkenColor(
      light.badgeHoverBg || light.bgTertiary || "#FEFEFE",
      0.10,
    ),
    loadingTextColor: "#999999",
    recalledBg: darkenColor(light.recalledBg || light.bgTertiary || "#FEFEFE", 0.10),
    joinNoticeBg: darkenColor(
      light.joinNoticeBg || light.bgTertiary || "#FEFEFE",
      0.10,
    ),
  };
};

/**
 * 个性装扮（动态壁纸）的产品策略：夜间模式下是否允许显示动态壁纸。
 *
 * 🔥 当前策略：夜间优先——夜间关闭个性装扮，完全回到普通暗色主题。
 * 将来若需「夜间也支持壁纸」，只需把这里改为 true，全站唯一开关生效，
 * 无需在 hasDynamicBackground 里到处找硬编码的 !systemPrefersDark。
 */
const DYNAMIC_WALLPAPER_ALLOWED_IN_DARK = false;

// ============================================================
// Store 定义
// ============================================================
export const useSiderColor = defineStore("siderColor", () => {
  // ---- 状态 ----
  const currentThemeType = ref<ThemeType>(DEFAULT_THEME_TYPE);
  const currentPaletteIndex = ref<number>(DEFAULT_PALETTE_INDEX);
  const currentSystemVariant = ref<SystemThemeVariant>("auto");
  const systemPrefersDark = ref(false);
  const customPalette = ref<ColorPalette | null>(null);

  // 主题预览模式（外观页不再提供预览入口，保留 API 以免其它窗口调用报错）
  const previewThemeMode = ref<"light" | "dark" | null>(null);

  const setPreviewThemeMode = (mode: "light" | "dark" | null) => {
    previewThemeMode.value = mode;
  };

  // ---- 系统主题监听 ----
  let mediaQuery: MediaQueryList | null = null;
  let mediaHandler: ((e: MediaQueryListEvent) => void) | null = null;

  const initSystemThemeListener = () => {
    if (!isClient() || mediaQuery) return;
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    systemPrefersDark.value = mediaQuery.matches;

    mediaHandler = (e: MediaQueryListEvent) => {
      systemPrefersDark.value = e.matches;
    };
    mediaQuery.addEventListener("change", mediaHandler);
  };

  const disposeSystemThemeListener = () => {
    if (mediaQuery && mediaHandler) {
      mediaQuery.removeEventListener("change", mediaHandler);
    }
    mediaQuery = null;
    mediaHandler = null;
  };

  const updateSystemPrefersDark = (isDark: boolean) => {
    systemPrefersDark.value = isDark;
  };

  // ---- 系统主题调色板 ----
  const getCurrentSystemPalette = (): ColorPalette => {
    const variant = currentSystemVariant.value;
    const shouldUseDark =
      variant === "dark" || (variant === "auto" && systemPrefersDark.value);

    if (shouldUseDark) {
      return buildDarkPaletteFromCSSVars();
    }

    return DEFAULT_LIGHT_PALETTE;
  };

  // ---- 核心计算属性 ----
  const currentColorPalette = computed(() => {
    const dark = systemPrefersDark.value;
    const previewMode = previewThemeMode.value;
    const type = currentThemeType.value;

    // ---------- 主题预览：夜间 ----------
    if (previewMode === "dark") {
      const base = resolveLightPalette(type);
      return buildDarkPaletteFromLight(base);
    }

    // ---------- system 主题 ----------
    if (type === "system") {
      return getCurrentSystemPalette();
    }

    // ---------- 基础配色 / custom ----------
    const lightPalette = resolveLightPalette(type);
    if (dark) {
      return buildDarkPaletteFromLight(lightPalette);
    }
    return lightPalette;
  });

  /** 解析当前应使用的"日间调色板" */
  const resolveLightPalette = (type: ThemeType): ColorPalette => {
    if (type === "custom") {
      return customPalette.value ?? DEFAULT_LIGHT_PALETTE;
    }
    if (type === "dynamic") {
      return buildDynamicPalette(currentPaletteIndex.value);
    }
    // base（默认）及历史保存的 classic / inkWash 统一使用基础配色
    return DEFAULT_LIGHT_PALETTE;
  };

  /** 日间基础调色板（不受夜间状态影响，供外观页日间预览使用） */
  const baseLightPalette = computed(() =>
    resolveLightPalette(currentThemeType.value),
  );

  // ---- 所有颜色属性 ----
  const currentColor = computed(
    () => currentColorPalette.value.color || DEFAULT_COLOR,
  );
  const bubbleBg = computed(() => {
    // 个性装扮（动态背景）时，气泡无背景，直接显示动态主题背景
    if (hasDynamicBackground.value) {
      return "transparent";
    }
    return currentColorPalette.value.bubbleBg || "#FFFFFF";
  });
  const bubbleBorder = computed(() => {
    // 个性装扮（动态背景）时，气泡无背景但保留白色半透明边框（勾勒气泡轮廓）
    if (hasDynamicBackground.value) {
      return "1px solid rgba(255, 255, 255, 0.45)";
    }
    return currentColorPalette.value.bubbleBorder || "none";
  });
  const bubbleTextColor = computed(() => {
    // 个性装扮（动态背景）时，气泡文字用白色 + 阴影（在 MessageDisplay 中处理）
    if (hasDynamicBackground.value) {
      return "#ffffff";
    }
    const bg = currentColorPalette.value.bubbleBg || "#FFFFFF";
    // 浅底→接近纯黑，深底→纯白，保证气泡文字足够"深"、清晰可读
    return isLightColor(bg) ? "#0A0A0A" : "#F5F5F5";
  });
  const bubbleShadow = computed(
    () => currentColorPalette.value.bubbleShadow || "none",
  );

  const sidebarBgColor = computed(() => currentColorPalette.value.sidebarBg);
  const sidebarTextColor = computed(
    () => currentColorPalette.value.sidebarText || "#1E293B",
  );
  const sidebarIconColor = computed(
    () => currentColorPalette.value.sidebarIcon || "#94A3B8",
  );
  const sidebarIconHoverColor = computed(
    () => currentColorPalette.value.hover || "#CBD5E1",
  );
  const sidebarIconActiveColor = computed(
    () => currentColorPalette.value.active || "#64748B",
  );
  const sidebarItemHoverBg = computed(() => {
    // 个性装扮（动态背景）时，用从背景吸取的主色生成半透明悬停色
    if (hasDynamicBackground.value && dynamicAccentColor.value) {
      return hexToRgba(dynamicAccentColor.value, 0.25);
    }
    return (
      currentColorPalette.value.sidebarHoverBg ||
      "rgba(148, 163, 184, 0.10)"
    );
  });
  const sidebarItemActiveBg = computed(() => {
    // 个性装扮（动态背景）时，用从背景吸取的主色生成半透明选中色
    if (hasDynamicBackground.value && dynamicAccentColor.value) {
      return hexToRgba(dynamicAccentColor.value, 0.45);
    }
    return (
      currentColorPalette.value.sidebarActiveBg ||
      "rgba(148, 163, 184, 0.15)"
    );
  });
  const contactItemHoverBg = computed(() => {
    // 个性装扮（动态背景）时，用从背景吸取的主色生成半透明悬停色
    if (hasDynamicBackground.value && dynamicAccentColor.value) {
      return hexToRgba(dynamicAccentColor.value, 0.25);
    }
    return (
      currentColorPalette.value.contactItemHover ||
      "rgba(148, 163, 184, 0.10)"
    );
  });
  const contactItemActiveBg = computed(() => {
    // 个性装扮（动态背景）时，用从背景吸取的主色生成半透明选中色
    if (hasDynamicBackground.value && dynamicAccentColor.value) {
      return hexToRgba(dynamicAccentColor.value, 0.45);
    }
    return (
      currentColorPalette.value.contactItemActive ||
      "rgba(148, 163, 184, 0.15)"
    );
  });

  const textSecondaryColor = computed(
    () => currentColorPalette.value.textSecondary || DEFAULT_TEXT_SECONDARY,
  );
  const borderLightColor = computed(
    () => currentColorPalette.value.borderLight || DEFAULT_BORDER_LIGHT,
  );
  const borderNormalColor = computed(
    () => currentColorPalette.value.borderNormal || DEFAULT_BORDER_NORMAL,
  );
  const bgTertiaryColor = computed(
    () => currentColorPalette.value.bgTertiary || DEFAULT_BG_TERTIARY,
  );
  const tagBgColor = computed(
    () => currentColorPalette.value.tagBg || "rgba(148, 163, 184, 0.06)",
  );
  const tagTextColor = computed(
    () => currentColorPalette.value.tagColor || currentColorPalette.value.color,
  );
  const linkColorValue = computed(
    () => currentColorPalette.value.linkColor || currentColorPalette.value.color,
  );
  const dangerColorValue = computed(
    () => currentColorPalette.value.dangerColor || DEFAULT_DANGER_COLOR,
  );
  const highlightBgColor = computed(
    () => currentColorPalette.value.highlightBg || DEFAULT_HIGHLIGHT_BG,
  );
  const highlightColorValue = computed(
    () => currentColorPalette.value.highlightColor || DEFAULT_HIGHLIGHT_COLOR,
  );
  const selectedBgColor = computed(
    () =>
      currentColorPalette.value.selectedBg || "rgba(148, 163, 184, 0.04)",
  );
  const textPrimaryColor = computed(
    () => currentColorPalette.value.textPrimary || "#0F172A",
  );
  const bgPrimaryColor = computed(
    () => currentColorPalette.value.bgPrimary || "#FFFFFF",
  );
  const primaryLightColor = computed(
    () =>
      currentColorPalette.value.primaryLight || "rgba(148, 163, 184, 0.06)",
  );
  const scrollbarTrackColor = computed(
    () => currentColorPalette.value.scrollbarTrack || DEFAULT_SCROLLBAR_TRACK,
  );
  const scrollbarThumbColor = computed(
    () => currentColorPalette.value.scrollbarThumb || DEFAULT_SCROLLBAR_THUMB,
  );

  // ===== 分割线 =====
  const dividerLineColorValue = computed(
    () =>
      currentColorPalette.value.dividerLineColor ||
      currentColorPalette.value.color ||
      "#CBD5E1",
  );

  /**
   * 面板分割线颜色（侧边栏 / 联系人列表 / 输入框统一使用）
   * 个性装扮（动态背景）时使用从壁纸吸取主色的加深版，保证深浅壁纸下都清晰可见；
   * 提取失败时回退到白色半透明（深色壁纸下可见）。
   */
  const panelDividerColor = computed(() =>
    hasDynamicBackground.value
      ? (dynamicAccentDeep.value || "rgba(255, 255, 255, 0.3)")
      : dividerLineColorValue.value,
  );

  /**
   * 动态背景（个性装扮）时的面板背景色（不透明）
   * 使用主题专属色（bgPrimary / color），避免半透明层在视频循环时重新合成导致闪动。
   */
  const dynamicPanelBg = computed(() => {
    const p = currentColorPalette.value;
    // 取主题背景色（bgPrimary），回退到主题色
    const base = p.bgPrimary || p.color || "#FFFFFF";
    const rgb = hexToRgb(base);
    return `rgb(${rgb})`;
  });
  const dividerLineWidth = computed(
    () => currentColorPalette.value.dividerLineWidth || "1.5px",
  );
  const dividerLineStyle = computed(
    () => currentColorPalette.value.dividerLineStyle || "solid",
  );
  const dividerLineShadow = computed(
    () => currentColorPalette.value.dividerLineShadow || "none",
  );
  const dividerTextColorValue = computed(
    () =>
      currentColorPalette.value.dividerTextColor ||
      currentColorPalette.value.color ||
      "#94A3B8",
  );
  const dividerSpacing = computed(
    () => currentColorPalette.value.dividerSpacing || "10px",
  );

  const dividerStyle = computed(() => ({
    borderColor: dividerLineColorValue.value,
    borderWidth: dividerLineWidth.value,
    borderStyle: dividerLineStyle.value,
    boxShadow: dividerLineShadow.value,
    margin: `${dividerSpacing.value} 0`,
    position: "relative" as const,
  }));

  const dividerTextStyle = computed(() => ({
    color: dividerTextColorValue.value,
    backgroundColor: "transparent",
    padding: `0 ${dividerSpacing.value}`,
    fontSize: "0.875rem",
    fontWeight: 500,
  }));

  // ---- 质感 ----
  const glassmorphismEnabled = computed(
    () => currentColorPalette.value.glassmorphism ?? false,
  );
  const blurAmount = computed(
    () => currentColorPalette.value.blurAmount ?? 16,
  );
  const shadowIntensity = computed(
    () => currentColorPalette.value.shadowIntensity ?? 0.06,
  );
  const borderGlow = computed(
    () => currentColorPalette.value.borderGlow ?? "transparent",
  );
  const texture = computed(() => currentColorPalette.value.texture ?? "matte");
  const saturation = computed(
    () => currentColorPalette.value.saturation ?? 1,
  );
  const brightness = computed(
    () => currentColorPalette.value.brightness ?? 1.05,
  );

  // ---- 聊天背景 ----
  const chatBgGradient = computed(
    () => currentColorPalette.value.chatBgGradient,
  );
  const chatBgSimpleGradient = computed(
    () => currentColorPalette.value.chatBgGradient,
  );
  const chatBgStartColor = computed(
    () => currentColorPalette.value.chatBgStart || "#FFFFFF",
  );
  const chatBgEndColor = computed(
    () => currentColorPalette.value.chatBgEnd || "#F1F5F9",
  );
  const chatBgMiddleColor = computed(
    () => currentColorPalette.value.chatBgMiddle || "#F8FAFC",
  );
  const chatBgOpacity = computed(
    () => currentColorPalette.value.chatBgOpacity ?? 1,
  );

  const chatBgAnimatedStyle = computed(() => ({
    background: chatBgGradient.value,
    opacity: chatBgOpacity.value,
    backdropFilter: glassmorphismEnabled.value
      ? `blur(${blurAmount.value}px)`
      : "none",
    WebkitBackdropFilter: glassmorphismEnabled.value
      ? `blur(${blurAmount.value}px)`
      : "none",
  }));

  // ===== 动态背景（图片 / 视频壁纸） =====
  const chatBgType = computed(
    () => currentColorPalette.value.chatBgType ?? "static",
  );
  const chatBgImage = computed(
    () => currentColorPalette.value.chatBgImage || "",
  );
  const chatBgVideo = computed(
    () => currentColorPalette.value.chatBgVideo || "",
  );
  const chatBgPoster = computed(
    () => currentColorPalette.value.chatBgPoster || "",
  );
  const chatBgOverlay = computed(
    () => currentColorPalette.value.chatBgOverlay || "transparent",
  );

  /**
   * 是否显示个性装扮（动态壁纸）背景。
   *
   * 这里是全站唯一的开关，关掉后 Sidebar / ContactList / MessageDisplay /
   * 消息页 / 好友页 / 设置中心的 `has-dynamic-bg` 样式与动态配色都会自动失效。
   */
  const hasDynamicBackground = computed(() => {
    // 夜间是否允许壁纸由模块级策略常量决定（单一开关，避免逻辑散落）
    if (systemPrefersDark.value && !DYNAMIC_WALLPAPER_ALLOWED_IN_DARK) {
      return false;
    }
    return (
      (chatBgType.value === "image" && !!chatBgImage.value) ||
      (chatBgType.value === "video" && !!chatBgVideo.value)
    );
  });

  /**
   * 从动态背景（视频/图片）吸取的主色调
   * 用于动态主题下的选中态配色（联系人选中、悬停等）。
   */
  const dynamicAccentColor = ref<string>("");
  const setDynamicAccentColor = (color: string) => {
    dynamicAccentColor.value = color || "";
  };
  /** 动态背景主色（hex），未提取到则回退到主题色 */
  const dynamicAccent = computed(
    () => dynamicAccentColor.value || currentColorPalette.value.color || "#94A3B8",
  );
  /** 动态背景主色的加深版（吸取的主色往往偏淡，分割线等细线条用它更醒目） */
  const dynamicAccentDeep = computed(() =>
    dynamicAccent.value ? darkenColor(dynamicAccent.value, 0.55) : "",
  );
  /** 动态背景主色的浅色半透明背景（用于更新入口等） */
  const dynamicAccentBgSoft = computed(() =>
    hexToRgba(dynamicAccent.value, 0.18),
  );
  /** 动态背景主色的半透明背景（用于悬停等） */
  const dynamicAccentBg = computed(() =>
    hexToRgba(dynamicAccent.value, 0.3),
  );
  /**
   * 动态背景主色的「图标版」：吸取的主色偏淡时自动加深，
   * 保证头部按钮 / 输入框工具这类图标在壁纸上仍然清晰可辨（而不是糊成一片白）。
   */
  const dynamicAccentIcon = computed(() => {
    const accent = dynamicAccent.value;
    if (!accent) return "#ffffff";
    return isLightColor(accent) ? dynamicAccentDeep.value || accent : accent;
  });

  // ---- 可用装扮壁纸（只保留个性装扮） ----
  const getAvailablePalettes = computed(() =>
    DYNAMIC_WALLPAPERS.map((w, index) => {
      const p = buildDynamicPalette(index);
      return {
        name: w.name,
        color: p.color,
        previewGradient: p.chatBgGradient,
        isDefault: index === 0,
        type: w.type,
        url: w.url,
      };
    }),
  );

  // ============================================================
  // 操作方法
  // ============================================================
  const setSystemTheme = (variant: SystemThemeVariant) => {
    currentThemeType.value = "system";
    currentSystemVariant.value = variant;
    customPalette.value = null;

    if (isClient()) {
      safeSetStorage("theme-type", "system");
      safeSetStorage("system-theme-variant", variant);
    }

    syncThemeAcrossWindows();
  };

  /** 启用个性装扮壁纸 */
  const setTheme = (index: number = 0) => {
    const type: ThemeType = "dynamic";
    currentThemeType.value = type;
    currentPaletteIndex.value = index;
    customPalette.value = null;

    if (isClient()) {
      safeSetStorage("theme-type", type);
      safeSetStorage("theme-palette-index", String(index));
    }

    syncThemeAcrossWindows();
  };

  const setCustomTheme = (palette: ColorPalette) => {
    currentThemeType.value = "custom";
    customPalette.value = palette;

    if (isClient()) {
      safeSetStorage("theme-type", "custom");
      safeSetStorage("custom-theme", JSON.stringify(palette));
    }

    syncThemeAcrossWindows();
  };

  /**
   * 跨窗口同步侧边栏颜色主题（Electron 环境）
   * 设置窗口修改主题后，广播给主窗口等其它窗口，使其立即重新加载主题。
   */
  const syncThemeAcrossWindows = () => {
    broadcastThemeSettings({ type: "color" });
  };

  const initTheme = () => {
    if (!isClient()) return;

    initSystemThemeListener();

    // 跨窗口同步：监听其它窗口广播的主题变化，立即重新加载主题
    onThemeSettingsChanged((settings) => {
      if (settings?.type === "color") {
        // 从 localStorage 重新读取主题设置并应用
        loadThemeFromStorage();
      }
    });

    // Web 端多标签页同步：监听 localStorage storage 事件
    window.addEventListener("storage", (e) => {
      if (
        e.key === "theme-type" ||
        e.key === "theme-palette-index" ||
        e.key === "system-theme-variant" ||
        e.key === "custom-theme"
      ) {
        loadThemeFromStorage();
      }
    });

    loadThemeFromStorage();
  };

  /**
   * 从 localStorage 读取主题设置并应用（供 initTheme 与跨窗口同步复用）
   */
  const loadThemeFromStorage = () => {
    try {
      const savedThemeType = safeGetStorage("theme-type") as ThemeType;

      if (savedThemeType === "system") {
        const savedVariant = safeGetStorage(
          "system-theme-variant",
        ) as SystemThemeVariant;

        if (savedVariant && ["light", "dark", "auto"].includes(savedVariant)) {
          currentThemeType.value = "system";
          currentSystemVariant.value = savedVariant;
          return;
        }
      }

      if (savedThemeType === "custom") {
        const savedCustom = safeGetStorage("custom-theme");
        if (savedCustom) {
          try {
            customPalette.value = JSON.parse(savedCustom);
            currentThemeType.value = "custom";
            return;
          } catch {
            // ignore
          }
        }
      }

      // 个性装扮：恢复上次选择的壁纸
      const savedPaletteIndex = safeGetStorage("theme-palette-index");
      const savedType = safeGetStorage("theme-type");
      if (savedType === "dynamic" && savedPaletteIndex !== null) {
        const index = parseInt(savedPaletteIndex, 10);
        if (!isNaN(index)) {
          currentThemeType.value = "dynamic";
          currentPaletteIndex.value = index;
          return;
        }
      }
    } catch (error) {
      console.error("读取主题设置失败:", error);
    }

    // 兜底：无保存设置时使用默认基础配色（直接设置状态，不触发跨窗口广播，避免递归）
    currentThemeType.value = DEFAULT_THEME_TYPE;
    currentPaletteIndex.value = 0;
    customPalette.value = null;
  };

  // ===== 样式方法 =====
  const getSidebarStyles = () => {
    const p = currentColorPalette.value;
    return {
      backgroundColor: p.sidebarBg,
      backgroundImage: "none",
      color: sidebarTextColor.value,
      boxShadow: p.sidebarShadow || "none",
      borderRight: p.sidebarBorder || "none",
      "--sidebar-text-color": sidebarTextColor.value,
      "--sidebar-icon-color": sidebarIconColor.value,
      "--sidebar-icon-hover-color": sidebarIconHoverColor.value,
      "--sidebar-icon-active-color": sidebarIconActiveColor.value,
      "--sidebar-item-hover-bg": sidebarItemHoverBg.value,
      "--sidebar-item-active-bg": sidebarItemActiveBg.value,
      "--glassmorphism": glassmorphismEnabled.value ? "true" : "false",
      "--blur-amount": `${blurAmount.value}px`,
      "--shadow-intensity": String(shadowIntensity.value),
      "--border-glow": borderGlow.value,
      "--texture": texture.value,
    };
  };

  const getChatAreaStyles = () => {
    return {
      background: chatBgGradient.value,
      opacity: chatBgOpacity.value,
      "--chat-bg-start": chatBgStartColor.value,
      "--chat-bg-end": chatBgEndColor.value,
      "--chat-bg-middle": chatBgMiddleColor.value,
      "--message-bubble-bg": bubbleBg.value,
      "--message-bubble-border": bubbleBorder.value,
      "--message-bubble-text": bubbleTextColor.value,
      // 不输出阴影变量，气泡无阴影
      backdropFilter: glassmorphismEnabled.value
        ? `blur(${blurAmount.value}px)`
        : "none",
      WebkitBackdropFilter: glassmorphismEnabled.value
        ? `blur(${blurAmount.value}px)`
        : "none",
      boxShadow: glassmorphismEnabled.value
        ? `inset 0 1px 0 rgba(255,255,255,0.5), 0 8px 32px rgba(0,0,0,${shadowIntensity.value * 0.5
        })`
        : "none",
    };
  };

  const getDividerStyles = () => ({
    border: `${dividerLineWidth.value} ${dividerLineStyle.value} ${dividerLineColorValue.value}`,
    boxShadow: dividerLineShadow.value,
    margin: `${dividerSpacing.value} 0`,
    position: "relative" as const,
  });

  const getDividerTextStyles = () => ({
    color: dividerTextColorValue.value,
    backgroundColor: "transparent",
    padding: `0 ${dividerSpacing.value}`,
    fontSize: "0.875rem",
    fontWeight: 500,
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
  });

  /**
   * 恢复到默认基础配色（非个性装扮壁纸）
   * 注意：不能复用 setTheme —— 它只接受壁纸索引，传主题名会被当成 index 写入存储。
   */
  const resetToDefault = () => {
    currentThemeType.value = DEFAULT_THEME_TYPE;
    currentPaletteIndex.value = DEFAULT_PALETTE_INDEX;
    customPalette.value = null;

    if (isClient()) {
      safeSetStorage("theme-type", DEFAULT_THEME_TYPE);
      safeSetStorage("theme-palette-index", String(DEFAULT_PALETTE_INDEX));
    }

    syncThemeAcrossWindows();
  };

  // ===== 返回 =====
  return {
    // 状态
    currentThemeType: readonly(currentThemeType),
    currentPaletteIndex: readonly(currentPaletteIndex),
    baseLightPalette,

    // 颜色属性
    currentColor,
    bubbleBg,
    bubbleBorder,
    bubbleTextColor,
    bubbleShadow,
    currentColorPalette,
    sidebarBgColor,
    sidebarTextColor,
    sidebarIconColor,
    sidebarIconHoverColor,
    sidebarIconActiveColor,
    sidebarItemHoverBg,
    sidebarItemActiveBg,
    contactItemHoverBg,
    contactItemActiveBg,
    textSecondaryColor,
    borderLightColor,
    borderNormalColor,
    bgTertiaryColor,
    tagBgColor,
    tagTextColor,
    linkColorValue,
    dangerColorValue,
    highlightBgColor,
    highlightColorValue,
    selectedBgColor,
    textPrimaryColor,
    bgPrimaryColor,
    primaryLightColor,
    scrollbarTrackColor,
    scrollbarThumbColor,

    // 分割线
    dividerLineColorValue,
    panelDividerColor,
    dynamicPanelBg,
    dividerLineWidth,
    dividerLineStyle,
    dividerLineShadow,
    dividerTextColorValue,
    dividerSpacing,
    dividerStyle,
    dividerTextStyle,

    // 聊天背景
    chatBgGradient,
    chatBgSimpleGradient,
    chatBgStartColor,
    chatBgEndColor,
    chatBgMiddleColor,
    chatBgOpacity,
    chatBgAnimatedStyle,

    // 动态背景
    chatBgType,
    chatBgImage,
    chatBgVideo,
    chatBgPoster,
    chatBgOverlay,
    hasDynamicBackground,
    dynamicAccentColor,
    setDynamicAccentColor,
    dynamicAccent,
    dynamicAccentDeep,
    dynamicAccentBgSoft,
    dynamicAccentBg,
    dynamicAccentIcon,

    // 质感
    glassmorphismEnabled,
    blurAmount,
    shadowIntensity,
    borderGlow,
    texture,
    saturation,
    brightness,

    // 方法
    getAvailablePalettes,
    setTheme,
    setSystemTheme,
    setCustomTheme,
    initTheme,
    resetToDefault,
    getSidebarStyles,
    getChatAreaStyles,
    getDividerStyles,
    getDividerTextStyles,

    // 系统
    currentSystemVariant: readonly(currentSystemVariant),
    systemPrefersDark: readonly(systemPrefersDark),
    updateSystemPrefersDark,

    // 预览
    previewThemeMode: readonly(previewThemeMode),
    setPreviewThemeMode,

    // 生命周期
    disposeSystemThemeListener,
  };
});