import { watch } from "vue";
import { useSiderColor } from "../stores/siderColor";
import { dynamicHexToRgba } from "../composables/useDynamicThemeVars";

/**
 * 动态主题（个性装扮）CSS 变量统一注入。
 *
 * 以前变量靠各页面根节点的 :style 注入（useDynamicThemeVars），
 * 没接的页面 / 深层子组件拿不到变量，只能在 scoped 里用 v-bind(...) 单独适配，
 * 导致同一套配色散落在几十处、改一处漏一片。
 *
 * 现在统一注入到 :root（documentElement），所有组件直接用 var(--dt-*) 即可继承，
 * 动态主题关闭时整体移除，不影响普通主题。
 */
export default defineNuxtPlugin(() => {
  const store = useSiderColor();
  const root = document.documentElement;

  /**
   * 始终注入的变量：非动态主题下也必须有值（取当前调色板派生的等价色），
   * 否则把组件里的 v-bind 换成 var(--dt-*) 后，普通主题会掉样式。
   */
  const ALWAYS_VARS = [
    "--dt-accent",
    "--dt-accent-deep",
    "--dt-accent-bg",
    "--dt-accent-bg-soft",
    "--dt-accent-icon",
    "--dt-overlay",
    "--dt-text",
    "--dt-text-shadow",
  ];

  /** 仅在动态主题下覆写的通用变量（普通主题必须留给主题系统自己定义） */
  const DYNAMIC_ONLY_VARS = [
    "--bg-primary",
    "--bg-secondary",
    "--bg-tertiary",
    "--bg-hover",
    "--card-bg",
    "--border-color",
    "--text-primary",
    "--text-secondary",
    "--text-tertiary",
    "--color-brand",
    "--color-brand-hover",
    "--color-brand-light",
    "--purple-color",
    "--error-color",
    "--error-bg",
    // 弹窗 / 抽屉的不透明卡面（仅动态主题存在，普通主题会回退到 --card-bg）
    "--dt-panel-solid",
  ];

  let cssRequested = false;

  /** 按需请求动态主题 CSS：只有开启壁纸时才拉这份样式 */
  const ensureDynamicThemeCss = () => {
    if (cssRequested) return;
    cssRequested = true;
    void import("../assets/css/theme-dynamic.css").catch((err) => {
      console.error("[动态主题] 主题样式加载失败:", err);
      cssRequested = false;
    });
  };

  const clearDynamicOnly = () => {
    for (const key of DYNAMIC_ONLY_VARS) {
      root.style.removeProperty(key);
    }
  };

  const applyVars = () => {
    // 给 <html> 打标记，标记当前是否处于动态主题（供样式按需判断）
    root.classList.toggle(
      "dynamic-theme",
      Boolean(store.hasDynamicBackground),
    );

    const accent = store.dynamicAccent || "#94A3B8"; // 非动态主题下自动回退到当前调色板主色
    const accentDeep = store.dynamicAccentDeep || accent;

    // 1) 始终注入：组件里 v-bind 换成 var(--dt-*) 后依赖这些值
    const always: Record<string, string> = {
      "--dt-accent": accent,
      "--dt-accent-deep": accentDeep,
      "--dt-accent-bg": dynamicHexToRgba(accent, 0.3),
      "--dt-accent-bg-soft": dynamicHexToRgba(accent, 0.18),
      "--dt-accent-icon": store.dynamicAccentIcon || "#ffffff",
      "--dt-overlay": store.hasDynamicBackground
        ? store.dynamicOverlayBg || "transparent"
        : "transparent",
      "--dt-text": "#ffffff",
      // 文字阴影已全局移除
      "--dt-text-shadow": "none",
      // 分割线 / 边框：跟随壁纸主色（主色偏暗时已自动提亮），不是固定白
      "--dt-divider": store.dynamicDividerColor || "rgba(255, 255, 255, 0.55)",
    };
    for (const [key, value] of Object.entries(always)) {
      root.style.setProperty(key, value);
    }

    // 2) 仅动态主题：覆写通用变量 + 按需加载主题 CSS
    if (!store.hasDynamicBackground) {
      clearDynamicOnly();
      return;
    }

    const panel = "rgba(0, 0, 0, 0.28)";
    const panelSoft = "rgba(0, 0, 0, 0.2)";
    const dynamicOnly: Record<string, string> = {
      "--bg-primary": "transparent",
      "--bg-secondary": panelSoft,
      "--bg-tertiary": panel,
      "--bg-hover": "rgba(255, 255, 255, 0.16)",
      "--card-bg": panel,
      "--border-color": "rgba(255, 255, 255, 0.45)",
      "--text-primary": "#ffffff",
      "--text-secondary": "rgba(255, 255, 255, 0.85)",
      "--text-tertiary": "rgba(255, 255, 255, 0.7)",
      "--color-brand": accent,
      "--color-brand-hover": accent,
      "--color-brand-light": dynamicHexToRgba(accent, 0.26),
      "--purple-color": accent,
      "--error-color": "#ff9b9b",
      "--error-bg": "rgba(248, 113, 113, 0.28)",
      // 弹窗 / 抽屉的卡面：不透明实底，避免壁纸透上来导致内容发花
      "--dt-panel-solid": "#1b1b20",
    };
    for (const [key, value] of Object.entries(dynamicOnly)) {
      root.style.setProperty(key, value);
    }

    ensureDynamicThemeCss();
  };

  watch(
    () => [
      store.hasDynamicBackground,
      store.dynamicAccent,
      store.dynamicAccentDeep,
      store.dynamicAccentIcon,
      store.dynamicOverlayBg,
      store.dynamicDividerColor,
    ],
    applyVars,
    { immediate: true },
  );
});
