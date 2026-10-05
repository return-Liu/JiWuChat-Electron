// ============================================================
// 主题工具函数（纯函数，无 store 依赖，可独立复用）
// ============================================================

export const isClient = () => typeof window !== "undefined";

export const safeGetStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const safeSetStorage = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error(`保存 ${key} 失败:`, error);
  }
};

/** 读取 CSS 变量（非客户端环境返回空串） */
export const readCSSVar = (varName: string): string => {
  if (!isClient()) return "";
  try {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(varName)
      .trim();
  } catch {
    return "";
  }
};

/** #RGB / #RRGGBB 转 "r, g, b" 字符串（失败回退白色） */
export const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : "255, 255, 255";
};

/** hex 转 rgba 字符串 */
export const hexToRgba = (hex: string, alpha: number): string => {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb}, ${alpha})`;
};

/** 把颜色（支持 hex / rgb / rgba）转成 [r,g,b] */
export const parseColor = (color: string): [number, number, number] | null => {
  if (!color) return null;
  const c = color.trim();

  // #rgb / #rrggbb
  if (c.startsWith("#")) {
    const hex = c.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    }
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
    return null;
  }

  // rgb / rgba
  const m = c.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (m) {
    return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
  }
  return null;
};

/** 相对亮度 0~255 */
export const luminanceOf = (color: string): number => {
  const rgb = parseColor(color);
  if (!rgb) return 255;
  const [r, g, b] = rgb;
  return 0.299 * r + 0.587 * g + 0.114 * b;
};

export const isLightColor = (color: string): boolean => luminanceOf(color) > 180;

export const darkenColor = (color: string, amount: number = 0.6): string => {
  const rgb = parseColor(color);
  if (!rgb) return color || "#8b5cf6";
  const [r, g, b] = rgb.map((v) => Math.round(v * amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
};

export const createShadow = (
  color: string,
  intensity: number = 0.15,
  blur: number = 24,
  spread: number = 0,
): string => {
  const rgb = hexToRgb(color);
  return `0 ${spread}px ${blur}px rgba(${rgb}, ${intensity})`;
};

export const createUnifiedGradient = (colors: string[], angle: number = 135): string => {
  const stops = colors.map(
    (c, i) => `${c} ${(i / (colors.length - 1)) * 100}%`,
  );
  return `linear-gradient(${angle}deg, ${stops.join(", ")})`;
};

export const createSidebarShadow = (color: string, intensity: number = 0.06): string => {
  const rgb = hexToRgb(color);
  return `2px 0 16px rgba(${rgb}, ${intensity}), 1px 0 4px rgba(${rgb}, ${intensity * 0.5})`;
};
