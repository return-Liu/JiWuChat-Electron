import { computed, type ComputedRef } from "vue";
import { useSiderColor } from "../stores/siderColor";

/**
 * 动态主题下用于面板 / 文字的底色风格：
 * - light：半透明白（适合 ChatWindow / 账户中心这类直接把内容浮在壁纸上的页面）
 * - dark ：半透明黑（适合设置中心这类内容密集、需要稳定对比度的页面）
 */
export type DynamicThemeSurface = "light" | "dark";

/** #RGB / #RRGGBB 转 rgba 字符串，用于生成半透明主色 */
export const dynamicHexToRgba = (hex: string, alpha: number): string => {
  const raw = (hex || "").replace("#", "");
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  const num = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(num)) return `rgba(255, 255, 255, ${alpha})`;
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
};

/**
 * 个性装扮（动态背景）下的主题变量覆写。
 *
 * 绑定在页面根节点的 :style 上即可让整页（含子组件）跟随动态壁纸：
 * 背景透明透出壁纸、文字转白、主色改用从壁纸吸取的颜色。
 */
export const useDynamicThemeVars = (
  surface: DynamicThemeSurface = "light",
): { dynamicThemeStyle: ComputedRef<Record<string, string>> } => {
  const siderColorStore = useSiderColor();

  const dynamicThemeStyle = computed<Record<string, string>>(() => {
    if (!siderColorStore.hasDynamicBackground) return {};

    const accent = siderColorStore.dynamicAccent;
    const dark = surface === "dark";
    const panel = dark ? "rgba(0, 0, 0, 0.28)" : "rgba(255, 255, 255, 0.18)";
    const panelSoft = dark ? "rgba(0, 0, 0, 0.2)" : "rgba(255, 255, 255, 0.12)";
    const panelHover = dark ? "rgba(255, 255, 255, 0.16)" : "rgba(255, 255, 255, 0.22)";

    return {
      "--bg-primary": "transparent",
      "--bg-secondary": dark ? "rgba(0, 0, 0, 0.24)" : panelSoft,
      "--bg-tertiary": dark ? "rgba(0, 0, 0, 0.28)" : panelSoft,
      "--bg-hover": panelHover,
      "--card-bg": panel,
      "--border-color": "rgba(255, 255, 255, 0.3)",
      "--text-primary": "#ffffff",
      "--text-secondary": "rgba(255, 255, 255, 0.85)",
      "--text-tertiary": "rgba(255, 255, 255, 0.7)",
      "--color-brand": accent,
      "--color-brand-hover": accent,
      "--color-brand-light": dynamicHexToRgba(accent, 0.26),
      "--purple-color": accent,
      "--error-color": "#ff9b9b",
      "--error-bg": "rgba(248, 113, 113, 0.28)",
    };
  });

  return { dynamicThemeStyle };
};
