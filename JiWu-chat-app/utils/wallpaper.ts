/**
 * 壁纸资源 URL 解析。
 *
 * 生成脚本始终输出本地路径（/theme/...），远程基址仅在运行时按构建注入的
 * NUXT_PUBLIC_WALLPAPER_BASE 拼接：
 * - 开发 / Web 构建：未设置该变量 → 原样返回本地路径（走本地动态主题）。
 * - 桌面端打包：设置该变量（如 https://jiwuchat.com）→ 拼接为 CDN 地址，
 *   安装包不再包含体积最大的视频。
 */
export function resolveWallpaperUrl(url?: string): string {
  if (!url) return "";
  const cfg = useRuntimeConfig().public as Record<string, unknown>;
  const base = (cfg.wallpaperBase as string | undefined) || "";
  if (!base) return url;
  return url.startsWith("/") ? `${base}${url}` : url;
}
