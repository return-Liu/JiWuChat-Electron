import { defineStore } from "pinia";
import { ref, computed, readonly, watch } from "vue";
import {
  extractColorFromVideo,
  extractColorFromUrl,
} from "../untils/colorExtractor";
import {
  broadcastThemeSettings,
  onThemeSettingsChanged,
} from "../untils/electronHelper";
import type { ThemeType, SystemThemeVariant, ColorPalette } from "./theme/types";
import {
  isClient,
  safeGetStorage,
  safeSetStorage,
  setThemeStorageUid,
  withThemeUid,
  readCSSVar,
  hexToRgb,
  hexToRgba,
  isLightColor,
  darkenColor,
  createUnifiedGradient,
  createSidebarShadow,
  parseColor,
  luminanceOf,
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

    sidebarHoverBg: "rgba(139, 92, 246, 0.04)",
    // 夜间选中态：与悬浮态一致
    sidebarActiveBg: "rgba(139, 92, 246, 0.04)",

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
    contactItemHover: "rgba(139, 92, 246, 0.12)",
    // 夜间选中态：比悬浮态略深，突出当前项
    contactItemActive: "rgba(139, 92, 246, 0.16)",

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

  dividerLineColor: "#d9d9d9",
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
import { resolveWallpaperUrl } from "~/utils/wallpaper";

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
    chatBgVideo: wallpaper.type === "video" ? resolveWallpaperUrl(wallpaper.url) : undefined,
    chatBgImage: wallpaper.type === "image" ? resolveWallpaperUrl(wallpaper.url) : undefined,
    // 封面：视频用抽帧生成的 poster，图片用自身；缺省时空串，前端退化为透明
    chatBgPoster:
      wallpaper.type === "video"
        ? resolveWallpaperUrl(wallpaper.poster || "")
        : resolveWallpaperUrl(wallpaper.url),
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

    sidebarHoverBg: `rgba(${hexToRgb(themeColor)}, 0.04)`,
    // 夜间选中态：与悬浮态一致
    sidebarActiveBg: `rgba(${hexToRgb(themeColor)}, 0.04)`,

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
    contactItemHover: `rgba(${hexToRgb(themeColor)}, 0.12)`,
    // 夜间选中态：比悬浮态略深，突出当前项
    contactItemActive: `rgba(${hexToRgb(themeColor)}, 0.16)`,

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
// 🔥 壁纸亮度采样：用于动态计算面板暗化值
// ============================================================

/**
 * 采样图片平均亮度。
 * 缩到 32x32 后用 Rec.709 亮度公式算加权平均。
 * @returns 0~1，0 全黑，1 全白
 */
function sampleImageBrightness(url: string): Promise<number> {
  return new Promise((resolve) => {
    if (!isClient()) return resolve(0.5);

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const SIZE = 32;
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(0.5);

        ctx.drawImage(img, 0, 0, SIZE, SIZE);
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

        let total = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          total += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        }
        resolve(total / (data.length / 4));
      } catch {
        resolve(0.5);
      }
    };
    img.onerror = () => resolve(0.5);
    img.src = url;
  });
}

/**
 * 采样视频平均亮度。
 * 加载元数据 → seek 到 0.5s（或时长中点，取较小者）→ 抽帧画到 canvas。
 * @returns 0~1
 */
function sampleVideoBrightness(url: string): Promise<number> {
  return new Promise((resolve) => {
    if (!isClient()) return resolve(0.5);

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";

    let settled = false;
    const finish = (value: number) => {
      if (settled) return;
      settled = true;
      try {
        video.src = "";
      } catch {
        /* ignore */
      }
      resolve(value);
    };

    video.addEventListener("loadedmetadata", () => {
      try {
        const duration = isFinite(video.duration) ? video.duration : 1;
        video.currentTime = Math.min(0.5, duration / 2);
      } catch {
        finish(0.5);
      }
    });

    video.addEventListener("seeked", () => {
      try {
        const SIZE = 32;
        const canvas = document.createElement("canvas");
        canvas.width = SIZE;
        canvas.height = SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) return finish(0.5);

        ctx.drawImage(video, 0, 0, SIZE, SIZE);
        const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

        let total = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          total += (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        }
        finish(total / (data.length / 4));
      } catch {
        finish(0.5);
      }
    });

    video.addEventListener("error", () => finish(0.5));

    // 兜底超时：3 秒内没拿到就按中间亮度走
    setTimeout(() => finish(0.5), 3000);

    video.src = url;
  });
}

/**
 * 根据壁纸 URL 类型选择采样方式，写入亮度。
 */
async function sampleWallpaperBrightness(url: string): Promise<number> {
  if (!url) return 0.5;
  const isVideo = /\.(mp4|webm|mov|m4v)(\?.*)?$/i.test(url);
  return isVideo ? sampleVideoBrightness(url) : sampleImageBrightness(url);
}

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

  // ---- 壁纸亮度：动态计算面板暗化值 ----
  /**
   * 壁纸平均亮度 0~1，默认 0.5（中间值）。
   * 图片/视频壁纸在启用时异步采样一次，结果缓存。
   */
  const wallpaperBrightness = ref(0.5);
  /** 采样进行中标记（避免重复触发） */
  const wallpaperBrightnessSampling = ref(false);
  /** 当前已采样的 URL，避免同一 URL 重复采样 */
  const sampledUrl = ref<string>("");
  /** 最新一个待采样目标：采样期间用户又切了壁纸时，记为「下一个要采的」而不是丢弃 */
  const pendingSampleUrl = ref<string>("");

  /**
   * 面板暗化透明度：亮度越高，暗化越强。
   * 0（全黑壁纸） → 0.05
   * 1（全白壁纸） → 0.35
   * 线性插值。
   */
  const dynamicOverlayOpacity = computed(() => {
    const b = Math.max(0, Math.min(1, wallpaperBrightness.value));
    return 0.05 + b * 0.3;
  });

  /** 面板背景（rgba 字符串，可直接用于 CSS） */
  const dynamicOverlayBg = computed(
    () => `rgba(0, 0, 0, ${dynamicOverlayOpacity.value.toFixed(3)})`,
  );

  /**
   * 触发壁纸亮度采样。
   * - 已采样过的 URL 直接跳过
   * - 采样中重复调用直接忽略
   * - 采样失败按 0.5 兜底
   */
  const ensureWallpaperBrightness = async (url: string) => {
    if (!url) return;
    if (sampledUrl.value === url && !wallpaperBrightnessSampling.value) return;

    // 记录最新目标：采样进行中再切壁纸时不再被丢掉
    pendingSampleUrl.value = url;
    if (wallpaperBrightnessSampling.value) return;

    wallpaperBrightnessSampling.value = true;
    try {
      // 循环采「最新目标」：期间用户切了壁纸就接着采新的，
      // 保证最终亮度一定对应最后选中的那张，而不是采样开始时的那张。
      while (pendingSampleUrl.value && pendingSampleUrl.value !== sampledUrl.value) {
        const target = pendingSampleUrl.value;
        const value = await sampleWallpaperBrightness(target);
        if (pendingSampleUrl.value !== target) continue; // 已过期，采下一个
        wallpaperBrightness.value = value;
        sampledUrl.value = target;
      }
    } catch (err) {
      console.warn("[壁纸亮度] 采样失败，回退中间值 0.5:", err);
      wallpaperBrightness.value = 0.5;
    } finally {
      wallpaperBrightnessSampling.value = false;
    }
  };

  // ---- 系统主题监听 ----
  let mediaQuery: MediaQueryList | null = null;
  let mediaHandler: ((e: MediaQueryListEvent) => void) | null = null;
  let domThemeObserver: MutationObserver | null = null;

  /**
   * 当前是否夜间：以 `<html class="dark">` 为唯一真相。
   *
   * 应用内主题（日间 / 夜间 / 跟随系统）最终都落在 html.dark 上，
   * 而系统媒体查询只在「跟随系统」时才是依据。
   * 之前直接写 mediaQuery.matches，会导致「应用内切夜间 + 系统是亮色」
   * 时这里被判成日间，于是联系人列表 / 侧边栏整套调色板仍是日间配色。
   */
  const syncDarkFromDom = () => {
    if (!isClient()) return;
    const dark = document.documentElement.classList.contains("dark");
    if (systemPrefersDark.value !== dark) systemPrefersDark.value = dark;
  };

  const initSystemThemeListener = () => {
    if (!isClient() || mediaQuery) return;

    syncDarkFromDom();

    // 主题切换（含跨窗口广播）都会改动 html.dark，直接跟随它
    domThemeObserver = new MutationObserver(syncDarkFromDom);
    domThemeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaHandler = () => {
      // 跟随系统模式下 useDark 随后会同步改动 html.dark，延后一拍再读；
      // 固定主题模式下 html.dark 不受系统影响，读到的仍是应用设定。
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(syncDarkFromDom);
      } else {
        syncDarkFromDom();
      }
    };
    mediaQuery.addEventListener("change", mediaHandler);
  };

  const disposeSystemThemeListener = () => {
    if (mediaQuery && mediaHandler) {
      mediaQuery.removeEventListener("change", mediaHandler);
    }
    mediaQuery = null;
    mediaHandler = null;

    domThemeObserver?.disconnect();
    domThemeObserver = null;
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

  /** 日间基础调色板（不受夜间状态影响，供外观页日间预览使用） */
  const baseLightPalette = computed(() =>
    resolveLightPalette(currentThemeType.value),
  );

  // ---- 所有颜色属性 ----
  const currentColor = computed(
    () => currentColorPalette.value.color || DEFAULT_COLOR,
  );
  // 气泡底色 / 描边 / 文字。
  // 动态壁纸主题下气泡不要底色（壁纸直接透出），文字用动态主题文字色。
  const bubbleBg = computed(() =>
    hasDynamicBackground.value
      ? "transparent"
      : currentColorPalette.value.bubbleBg || "#FFFFFF",
  );
  const bubbleBorder = computed(() =>
    hasDynamicBackground.value
      ? "1px solid var(--dt-divider, rgba(255, 255, 255, 0.55))"
      : currentColorPalette.value.bubbleBorder || "none",
  );
  const bubbleTextColor = computed(() => {
    if (hasDynamicBackground.value) return "#ffffff";
    const bg = currentColorPalette.value.bubbleBg || "#FFFFFF";
    return isLightColor(bg) ? "#0A0A0A" : "#F5F5F5";
  });
  const bubbleShadow = computed(
    () => currentColorPalette.value.bubbleShadow || "none",
  );

  const sidebarBgColor = computed(() => currentColorPalette.value.sidebarBg);
  const sidebarTextColor = computed(
    () => currentColorPalette.value.sidebarText || "#1E293B",
  );
  // 动态主题下侧边栏图标（含选中态）跟随壁纸吸色；
  // 否则沿用调色板图标色（极简白的 #D0D0D0 / 选中 #C8C8C8 在壁纸上几乎看不见）。
  const sidebarIconColor = computed(() =>
    hasDynamicBackground.value
      ? dynamicAccentIcon.value
      : currentColorPalette.value.sidebarIcon || "#94A3B8",
  );
  const sidebarIconHoverColor = computed(() =>
    hasDynamicBackground.value
      ? dynamicAccentIcon.value
      : currentColorPalette.value.hover || "#CBD5E1",
  );
  const sidebarIconActiveColor = computed(() =>
    hasDynamicBackground.value
      ? dynamicAccentIcon.value
      : currentColorPalette.value.active || "#64748B",
  );
  // ---- 动态主题主色（从壁纸吸取）----
  /** 从当前壁纸（图片/视频）吸取到的主色，空字符串表示尚未取到 */
  const dynamicAccentColor = ref<string>("");
  const setDynamicAccentColor = (color: string) => {
    dynamicAccentColor.value = color || "";
  };


  /**
   * 动态主题下 hover / active 的叠加透明度。
   *
   * 侧边栏与联系人列表共用同一组值：同一吸色主色在不同区域必须是同一个深浅，
   * 否则「侧边栏选中」和「联系人选中」看起来像两套配色。
   */
  const DYNAMIC_OVERLAY_HOVER = 0.34;
  const DYNAMIC_OVERLAY_ACTIVE = 0.58;

  /**
   * 动态主题下 hover/active 的叠加色：**一律使用壁纸吸色主色**（accent）。
   * 不做「亮壁纸黑 / 暗壁纸白」的黑白兜底 —— 兜底色看起来就是「变回默认主题」。
   */
  const dynamicItemOverlay = (alpha: number): string =>
    hexToRgba(dynamicAccent.value, alpha);

  const sidebarItemHoverBg = computed(() => {
    if (hasDynamicBackground.value) {
      return dynamicItemOverlay(DYNAMIC_OVERLAY_HOVER);
    }
    return (
      currentColorPalette.value.sidebarHoverBg ||
      "rgba(148, 163, 184, 0.10)"
    );
  });
  const sidebarItemActiveBg = computed(() => {
    if (hasDynamicBackground.value) {
      // 选中态：比悬浮更重，突出当前项
      return dynamicItemOverlay(DYNAMIC_OVERLAY_ACTIVE);
    }
    return (
      currentColorPalette.value.sidebarActiveBg ||
      "rgba(148, 163, 184, 0.15)"
    );
  });
  const contactItemHoverBg = computed(() => {
    if (hasDynamicBackground.value) {
      return dynamicItemOverlay(DYNAMIC_OVERLAY_HOVER);
    }
    return (
      currentColorPalette.value.contactItemHover ||
      "rgba(148, 163, 184, 0.10)"
    );
  });
  const contactItemActiveBg = computed(() => {
    if (hasDynamicBackground.value) {
      // 选中态：叠加 accent 色调，既醒目又跟随壁纸配色（加深一点，仍保持半透明不厚重）
      return dynamicItemOverlay(DYNAMIC_OVERLAY_ACTIVE);
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
  /** 成功色（在线状态 / 已同步等正向提示） */
  const successColorValue = computed(
    () => currentColorPalette.value.successColor || "#22c55e",
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
   * 动态主题下的分割线 / 边框色：**跟着壁纸主色走**，不是固定白。
   * 主色偏暗时按亮度向白色提亮，保证在花哨壁纸上仍然看得清。
   */
  const dynamicDividerColor = computed(() => {
    const accent = dynamicAccent.value || "#94A3B8";
    const rgb = parseColor(accent);
    if (!rgb) return "rgba(255, 255, 255, 0.6)";

    const lum = luminanceOf(accent);
    // 越暗越往白色靠（幅度收着来，分割线要「看得清」而不是「很亮」）
    const ratio = lum < 140 ? 0.3 : lum < 200 ? 0.15 : 0;
    const [r, g, b] = rgb.map((c) => Math.round(c + (255 - c) * ratio));
    return `rgba(${r}, ${g}, ${b}, 0.45)`;
  });

  const panelDividerColor = computed(() => {
    if (!hasDynamicBackground.value) {
      return dividerLineColorValue.value;
    }
    // 动态主题：分割线取壁纸主色（更实，避免 0.22 那种几乎看不见的半透明）
    return dynamicDividerColor.value;
  });

  const dynamicPanelBg = computed(() => {
    const p = currentColorPalette.value;
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

  const hasDynamicBackground = computed(() => {
    if (systemPrefersDark.value && !DYNAMIC_WALLPAPER_ALLOWED_IN_DARK) {
      return false;
    }
    return (
      (chatBgType.value === "image" && !!chatBgImage.value) ||
      (chatBgType.value === "video" && !!chatBgVideo.value)
    );
  });

  // ---- 动态背景取色（唯一实现放在 store，页面 / 组件不再各取一次）----
  /** 渲染中的壁纸视频元素，由 <DynamicBackground> 注册 */
  const dynamicBgVideoEl = ref<HTMLVideoElement | null>(null);
  /** 取色缓存：壁纸 URL → 主色（跨路由复用，避免重复解码取色） */
  const accentCache = new Map<string, string>();
  /** 兜底补取计数 / 定时器（防止取色一直失败时空转） */
  let accentRetryCount = 0;
  let accentRetryTimer: ReturnType<typeof setTimeout> | null = null;

  const registerDynamicBgVideo = (el: HTMLVideoElement | null) => {
    dynamicBgVideoEl.value = el ?? null;
  };

  const clearAccentRetry = () => {
    if (accentRetryTimer) {
      clearTimeout(accentRetryTimer);
      accentRetryTimer = null;
    }
  };

  const scheduleAccentRetry = () => {
    if (accentRetryCount >= 6) return;
    accentRetryCount++;
    clearAccentRetry();
    accentRetryTimer = setTimeout(() => {
      void refreshDynamicAccent();
    }, 600);
  };

  /**
   * 写入主色前先按「当前壁纸 URL」校验。
   * 🔥 不再用自增 token：token 会被任何一次无关的 watch 触发顶掉，
   *    异步取色结果就会被误判成「过期」丢弃 → 主色一直为空，
   *    表现就是「切了动态主题要刷新界面才吸到色」。
   *    直接比对「取色用的壁纸是否仍是当前壁纸」，语义更准也不会误杀。
   */
  const commitAccent = (sourceUrl: string, color: string | null): boolean => {
    if (!color) return false;
    const current =
      chatBgType.value === "video" ? chatBgVideo.value : chatBgImage.value;
    // 壁纸又换了 → 丢弃过期结果
    if (sourceUrl !== current) return false;
    dynamicAccentColor.value = color;
    accentRetryCount = 0;
    clearAccentRetry();
    console.log("[动态主题] 吸色已更新:", color);
    return true;
  };

  /** 视频取色；视频未解码就绪时返回 false，由调用方稍后重试 */
  const extractAccentFromVideo = (): boolean => {
    const key = chatBgVideo.value || "";
    const video = dynamicBgVideoEl.value;
    if (!key || !video || video.readyState < 2) return false;
    const cached = accentCache.get(key);
    if (cached) return commitAccent(key, cached);
    const color = extractColorFromVideo(video);
    if (color) accentCache.set(key, color);
    return commitAccent(key, color);
  };

  /** 按当前壁纸（图片 / 视频）重新取一次主色 */
  async function refreshDynamicAccent() {
    clearAccentRetry();

    if (!hasDynamicBackground.value) {
      dynamicAccentColor.value = "";
      return;
    }

    // 视频壁纸：等解码就绪后取色（loadeddata + 定时兜底双保险）
    if (chatBgType.value === "video" && chatBgVideo.value) {
      // 🔥 优先用海报图（固定抽帧封面）取色。
      //    直接抽视频当前帧的话，取到的是「取色那一刻正好播到的那帧」：
      //    从设置页回到消息界面 vs 刷新界面，播放进度不同 → 选中色完全不同。
      //    海报图是固定的，结果稳定且可缓存，跨刷新完全一致。
      const poster = chatBgPoster.value;
      if (poster) {
        const posterKey = `poster:${poster}`;
        const cachedPoster = accentCache.get(posterKey);
        if (cachedPoster) {
          commitAccent(chatBgVideo.value, cachedPoster);
          return;
        }

        if (dynamicAccentColor.value) dynamicAccentColor.value = "";
        let posterColor: string | null = null;
        try {
          posterColor = await extractColorFromUrl(poster);
        } catch (e) {
          console.warn("[动态主题] 海报取色失败，回退视频帧:", e);
        }
        if (posterColor) {
          accentCache.set(posterKey, posterColor);
          if (commitAccent(chatBgVideo.value, posterColor)) return;
        }
        // 海报取色失败（或缺图）→ 继续走下面的视频帧取色
      }

      if (extractAccentFromVideo()) return;
      dynamicAccentColor.value = "";
      const video = dynamicBgVideoEl.value;
      video?.addEventListener(
        "loadeddata",
        () => {
          void refreshDynamicAccent();
        },
        { once: true },
      );
      scheduleAccentRetry();
      return;
    }

    const image = chatBgImage.value;
    if (chatBgType.value !== "image" || !image) {
      dynamicAccentColor.value = "";
      return;
    }

    const cached = accentCache.get(image);
    if (cached && commitAccent(image, cached)) return;

    // 换图期间先清掉旧主色，避免沿用上一张壁纸的色
    if (dynamicAccentColor.value) dynamicAccentColor.value = "";
    let color: string | null = null;
    try {
      color = await extractColorFromUrl(image);
    } catch (e) {
      console.warn("[动态主题] 壁纸取色失败:", e);
    }
    if (color) accentCache.set(image, color);
    if (commitAccent(image, color ?? null)) return;

    // 取色失败（或期间又换了壁纸）→ 兜底重试：
    // 首次加载大图失败/超时时重试通常就能成功（此时图片已进浏览器缓存）。
    if (chatBgImage.value === image) scheduleAccentRetry();
  }

  // 壁纸 / 调色板索引 / 视频元素变化 → 重新取色。
  // 必须同时监听这些：切主题时 video 元素往往复用同一个 DOM 只换 src，
  // 而两个主题共用同一 URL 时 URL 也不变，靠 currentPaletteIndex 兜住「切主题」。
  watch(
    [
      hasDynamicBackground,
      chatBgType,
      chatBgImage,
      chatBgVideo,
      dynamicBgVideoEl,
      currentPaletteIndex,
    ],
    () => {
      accentRetryCount = 0;
      void refreshDynamicAccent();
    },
    { immediate: true, flush: "post" },
  );

  // 🔥 兜底自愈：壁纸已就绪但主色仍为空时自动补取。
  //    覆盖「异步取色结果被丢弃」「组件重挂载后主色丢失」「视频解码晚于首次取色」等场景，
  //    避免一直停在空值（会回退成中性灰蓝，看起来就是「没有吸色、必须刷新界面」）。
  watch(
    [
      dynamicAccentColor,
      hasDynamicBackground,
      chatBgType,
      chatBgImage,
      chatBgVideo,
      dynamicBgVideoEl,
    ],
    () => {
      if (!hasDynamicBackground.value || dynamicAccentColor.value) {
        clearAccentRetry();
        return;
      }
      scheduleAccentRetry();
    },
  );

  /** 暂停 / 恢复壁纸视频（窗口切后台、组件卸载时用，避免后台常驻解码） */
  const pauseDynamicBgVideo = () => {
    dynamicBgVideoEl.value?.pause();
  };
  const resumeDynamicBgVideo = () => {
    void dynamicBgVideoEl.value?.play().catch(() => {
      /* 自动播放被拦截时忽略 */
    });
  };

  const dynamicAccent = computed(() => {
    if (dynamicAccentColor.value) return dynamicAccentColor.value;
    // 🔥 动态主题下吸色未就绪时，绝不能回退到调色板主色：
    //    个性装扮的调色板复用基础日间配色（color = #DCDCDC 近白），
    //    回退过去会让选中/悬浮态看起来就是「黑白选中」，掩盖了吸色还没跑完的事实。
    //    这里统一用中性灰蓝兜底，等吸色完成再自动被壁纸真实主色替换。
    if (hasDynamicBackground.value) return "#94A3B8";
    return currentColorPalette.value.color || "#94A3B8";
  });
  const dynamicAccentDeep = computed(() =>
    dynamicAccent.value ? darkenColor(dynamicAccent.value, 0.55) : "",
  );
  const dynamicAccentBgSoft = computed(() =>
    hexToRgba(dynamicAccent.value, 0.18),
  );
  const dynamicAccentBg = computed(() =>
    hexToRgba(dynamicAccent.value, 0.3),
  );
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
        url: resolveWallpaperUrl(w.url),
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

  const syncThemeAcrossWindows = () => {
    broadcastThemeSettings({ type: "color" });
  };

  const initTheme = () => {
    if (!isClient()) return;

    initSystemThemeListener();

    onThemeSettingsChanged((settings) => {
      if (settings?.type === "color") {
        loadThemeFromStorage();
      }
    });

    window.addEventListener("storage", (e) => {
      const themeKeys = [
        "theme-type",
        "theme-palette-index",
        "system-theme-variant",
        "custom-theme",
      ];
      if (e.key && themeKeys.some((k) => withThemeUid(k) === e.key)) {
        loadThemeFromStorage();
      }
    });

    loadThemeFromStorage();
  };

  /**
   * 设置当前用户（登录/切换账号时调用），使主题设置按用户隔离存储。
   * 设置 uid 后立即重新加载该用户的主题，避免沿用上一个账号的主题。
   */
  const setCurrentUser = (userId: string | number | null) => {
    setThemeStorageUid(userId);
    if (isClient()) {
      loadThemeFromStorage();
    }
  };

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
      // 分割线统一用 panelDividerColor，与联系人列表/聊天头部/输入框保持一致；
      // 原 sidebarBorder 是极浅的 rgba(220,220,220,0.05)，在极简白下几乎不可见。
      borderRight: `1px solid ${panelDividerColor.value}`,
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

  // ============================================================
  // 🔥 监听壁纸变化 → 重新采样亮度
  // ============================================================
  // 用 computed 拿到当前生效的壁纸 URL（图片或视频）
  const currentWallpaperUrl = computed(() => {
    if (!hasDynamicBackground.value) return "";
    return chatBgType.value === "video" ? chatBgVideo.value : chatBgImage.value;
  });

  // 监听当前壁纸 URL，变化时触发采样
  // 注意：Vue 的 watch 需要在 store 内部调用，才能保证响应式生效
  // 直接调用 watch 即可（Pinia 的 setup store 支持）
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  watch(
    currentWallpaperUrl,
    (url) => {
      if (url) {
        void ensureWallpaperBrightness(url);
      } else {
        // 没有壁纸时复位到中间亮度
        wallpaperBrightness.value = 0.5;
        sampledUrl.value = "";
      }
    },
    { immediate: true },
  );

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
    successColorValue,
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
    dynamicDividerColor,
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
    // 动态背景取色（唯一实现在 store）
    registerDynamicBgVideo,
    pauseDynamicBgVideo,
    resumeDynamicBgVideo,
    dynamicAccent,
    dynamicAccentDeep,
    dynamicAccentBgSoft,
    dynamicAccentBg,
    dynamicAccentIcon,

    // ✅ 壁纸亮度 → 面板暗化透明度
    wallpaperBrightness: readonly(wallpaperBrightness),
    dynamicOverlayOpacity,
    dynamicOverlayBg,

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
    setCurrentUser,
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