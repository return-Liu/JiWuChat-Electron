/**
 * 主题管理 composable
 * 支持 light / dark / system 三种模式
 * View Transition API 实现圆形裁剪切换动画
 */
import { useDark } from "@vueuse/core";
import { getCurrentScope, nextTick, onScopeDispose, ref } from "vue";
import {
    broadcastThemeSettings,
    onThemeSettingsChanged,
} from "../untils/electronHelper";
import { useSiderColor } from "../stores/siderColor";
import { withThemeUid } from "../stores/theme/utils";

interface DocumentWithViewTransition extends Document {
    startViewTransition?: (callback: () => Promise<void> | void) => any;
}

const THEME_STORAGE_KEY = "vitepress-theme-appearance";
const THEME_MODE_KEY = "theme-mode";

const supportsVT = () => {
    if (typeof window === "undefined") return false;
    const doc = document as DocumentWithViewTransition;
    return typeof doc.startViewTransition === "function" &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

let latestTransitionId = 0;

/**
 * 读取保存的明暗模式。
 * 主题模式按用户 uid 隔离存储（theme_<uid>_theme-mode），但独立窗口（设置/账户中心等）
 * 在登录态就绪前拿不到 uid，键会退化成不带 uid 的旧键。
 * 这里两处都读一次，避免「uid 键没读到 → 直接回退成 light」，表现为
 * 「明明已经切到夜间，设置窗口却还是日间」。
 */
const readSavedThemeMode = (): 'light' | 'dark' | 'system' | null => {
    if (typeof window === "undefined") return null;
    let scoped: string | null = null;
    let legacy: string | null = null;
    try {
        scoped = localStorage.getItem(withThemeUid(THEME_MODE_KEY));
        legacy = localStorage.getItem(THEME_MODE_KEY);
    } catch {
        return null;
    }
    const value = scoped || legacy;
    return value === "light" || value === "dark" || value === "system" ? value : null;
};

/**
 * 把主题模式镜像到不带 uid 的全局键：
 * - `theme-mode`：独立窗口（设置/账户中心）在 uid 就绪前靠它兜底读取；
 * - `vitepress-theme-appearance`：nuxt.config 的首屏脚本读这个键，
 *   写入后独立窗口刷新就直接是夜间，不再先白后黑。
 */
const mirrorThemeModeToGlobal = (mode: 'light' | 'dark' | 'system') => {
    if (typeof window === "undefined") return;
    try {
        localStorage.setItem(THEME_MODE_KEY, mode);
        const dark =
            mode === "dark" ||
            (mode === "system" &&
                window.matchMedia("(prefers-color-scheme: dark)").matches);
        localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
    } catch {
        // 存储不可用（隐私模式等）时忽略
    }
};

/**
 * 主题模式：模块级共享。
 * 同一窗口内可能同时存在多个 useTheme() 实例（布局、侧边栏、设置外观页、个性装扮页），
 * 之前各实例各自维护一份 ref，导致某个组件切换主题后其它组件状态不同步
 * （例：个性装扮页确认切到日间模式，外观页仍高亮夜间模式）。
 */
const themeMode = ref<'light' | 'dark' | 'system'>(
    readSavedThemeMode() || "light"
);

/** 同窗口内的实例互相通知：主题模式变化后让所有实例重新应用 */
const themeSyncHandlers = new Set<() => void>();
const notifyThemeChanged = () => {
    themeSyncHandlers.forEach((handler) => {
        try {
            handler();
        } catch (error) {
            console.error("[主题] 同步失败:", error);
        }
    });
};

/**
 * 登录 / 切换账号后，按当前 uid 重新加载明暗模式。
 * themeMode 是模块级共享 ref，uid 变化时需显式重读存储，否则会沿用上一个账号的模式。
 */
export function reloadThemeMode() {
    const saved = readSavedThemeMode();
    // 读不到时保留当前模式，不要硬回退成 light（会把夜间顶掉）
    if (saved) themeMode.value = saved;
    notifyThemeChanged();
}

export function useTheme() {
    /**
     * 🔥 主题模式的唯一数据源是模块级的 themeMode。
     * useDark 会按「自己 storageKey 里的值」初始化并写 <html>，
     * 但同一个窗口里可能同时存在多个实例（登录前/后 withThemeUid 不同 → 键不同），
     * 键里没写过时会落到 'auto'（跟随系统）或旧值，从而把已经生效的 html.dark 顶掉。
     * 所以这里显式给出 initialValue，并在创建后立刻用 applyTheme() 纠正一次。
     */
    const isDark = useDark({
        storageKey: withThemeUid(THEME_STORAGE_KEY),
        valueDark: "dark",
        valueLight: "light",
        initialValue: themeMode.value === "system" ? "auto" : themeMode.value,
    });

    // 侧边栏颜色 store：用于同步明暗模式到 siderColor.systemPrefersDark，
    // 使 Sidebar / MessageDisplay / ContactList 等组件的颜色随日间/夜间切换更新
    let siderColorStore: ReturnType<typeof useSiderColor> | null = null;
    try {
        siderColorStore = useSiderColor();
    } catch {
        // siderColor store 未初始化时忽略（例如在非组件上下文）
    }

    let isAnimating = false;
    let systemMediaQuery: MediaQueryList | null = null;

    const resolveIsDark = () => {
        if (themeMode.value === "system") {
            return window.matchMedia("(prefers-color-scheme: dark)").matches;
        }
        return themeMode.value === "dark";
    };

    const applyTheme = () => {
        const dark = resolveIsDark();
        if (isDark.value !== dark) {
            isDark.value = dark;
        }
        // 🔥 关键：同步明暗模式到 siderColor，驱动组件颜色更新
        // siderColor.currentColorPalette 依赖 systemPrefersDark 决定返回暗色/亮色调色板
        if (siderColorStore) {
            siderColorStore.updateSystemPrefersDark(dark);
        }
    };

    /**
     * 🔥 每个实例创建后立刻纠正一次：
     * useDark 初始化时会用它自己 storageKey 里的旧值写 <html>，
     * 后创建的实例可能因此把夜间样式顶回日间（典型表现：设置窗口里
     * 「已经切到夜间，设置组件却还是日间配色」）。这里统一以 themeMode 为准。
     */
    if (typeof window !== "undefined") {
        applyTheme();
    }

    // 注册同窗口同步回调，组件作用域销毁时自动注销
    themeSyncHandlers.add(applyTheme);
    if (getCurrentScope()) {
        onScopeDispose(() => {
            themeSyncHandlers.delete(applyTheme);
        });
    }

    const setThemeMode = (mode: 'light' | 'dark' | 'system') => {
        if (themeMode.value === mode) return;
        themeMode.value = mode;
        if (typeof window !== "undefined") {
            localStorage.setItem(withThemeUid(THEME_MODE_KEY), mode);
            // 全局镜像：独立窗口（设置/账户中心/编辑资料等）在 uid 就绪前读不到
            // 带 uid 的键，靠这两个不带 uid 的键兜住「一打开就是夜间」。
            mirrorThemeModeToGlobal(mode);
        }
        applyTheme();
        // 同窗口内的其它 useTheme() 实例立即同步
        notifyThemeChanged();
        // 跨窗口同步：通知其它窗口（主窗口/Web）立即应用新主题
        console.log("[主题] setThemeMode 广播:", mode);
        broadcastThemeSettings({ type: "mode", mode });
    };

    const setTheme = (newTheme: 'light' | 'dark') => {
        setThemeMode(newTheme);
    };

    const toggleTheme = (event?: MouseEvent, targetDark?: boolean) => {
        if (isAnimating) return;

        const currentDark = resolveIsDark();
        const willBeDark = targetDark !== undefined ? targetDark : !currentDark;
        const targetMode: 'light' | 'dark' = willBeDark ? 'dark' : 'light';

        // 显式指定目标模式时（如外观页选择「日间/夜间」卡片）：
        // 即使当前视觉明暗已一致，也要把模式从 system 切到明确的 light/dark，
        // 否则模式状态不会更新（卡片选中态错乱）。
        const modeChanged = themeMode.value !== targetMode;
        // 视觉无变化且模式也无需变更时，无需任何操作
        if (willBeDark === currentDark && !modeChanged) return;

        // 视觉无变化（例如 system-dark → 明确 dark）：直接更新模式，无需播放动画
        if (willBeDark === currentDark) {
            setThemeMode(targetMode);
            return;
        }

        if (!supportsVT() || !event) {
            setThemeMode(targetMode);
            return;
        }

        isAnimating = true;

        const { clientX: x, clientY: y } = event;
        const { innerWidth: w, innerHeight: h } = window;

        const endRadius = Math.hypot(Math.max(x, w - x), Math.max(y, h - y));
        const ratioX = (100 * x) / w;
        const ratioY = (100 * y) / h;
        const referR = Math.hypot(w, h) / Math.SQRT2;
        const ratioR = (100 * endRadius) / referR;

        const transitionId = ++latestTransitionId;
        const root = document.documentElement;

        root.dataset.themeTransition = willBeDark ? "to-dark" : "to-light";
        root.style.setProperty("--theme-transition-x", `${ratioX}%`);
        root.style.setProperty("--theme-transition-y", `${ratioY}%`);
        root.style.setProperty("--theme-transition-radius", `${ratioR}%`);

        const doc = document as DocumentWithViewTransition;

        const cleanupTransitionVars = () => {
            delete root.dataset.themeTransition;
            root.style.removeProperty("--theme-transition-x");
            root.style.removeProperty("--theme-transition-y");
            root.style.removeProperty("--theme-transition-radius");
        };

        try {
            const transition = doc.startViewTransition!(async () => {
                setThemeMode(targetMode);
                await nextTick();
            });

            transition.finished.finally(() => {
                if (transitionId !== latestTransitionId) return;
                cleanupTransitionVars();
                isAnimating = false;
            });
        } catch (error) {
            // 🔥 动画启动失败（例如已有过渡在跑）时必须降级为直接切换：
            //    否则 isAnimating 永远停在 true，之后所有切主题都会被静默忽略
            //    （表现就是「明明点了夜间模式，组件一直不更新」）。
            console.error("[主题] 切换动画启动失败，降级为直接切换:", error);
            cleanupTransitionVars();
            isAnimating = false;
            setThemeMode(targetMode);
        }
    };

    const initTheme = () => {
        if (typeof window !== "undefined") {
            const saved = readSavedThemeMode();
            if (saved) themeMode.value = saved;
            // 顺手刷新全局镜像，保证之后打开的独立窗口能直接读到当前模式
            mirrorThemeModeToGlobal(themeMode.value);
        }

        if (typeof window !== "undefined") {
            systemMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
            systemMediaQuery.addEventListener("change", () => {
                if (themeMode.value === "system") {
                    applyTheme();
                }
            });
        }

        applyTheme();

        // 跨窗口同步：监听其它窗口广播的主题变化，立即应用
        if (typeof window !== "undefined") {
            onThemeSettingsChanged((settings) => {
                console.log("[主题] 收到广播:", settings);
                if (settings?.type === "mode" && settings.mode) {
                    const mode = settings.mode as 'light' | 'dark' | 'system';
                    if (themeMode.value !== mode) {
                        themeMode.value = mode;
                        localStorage.setItem(withThemeUid(THEME_MODE_KEY), mode);
                        // 同步全局镜像，让其它窗口（uid 可能不同）也能读到
                        mirrorThemeModeToGlobal(mode);
                    }
                    applyTheme();
                    notifyThemeChanged();
                }
            });

            // Web 端多标签页同步：监听 localStorage storage 事件
            // （同时兼容带 uid 的键与全局镜像键：独立窗口的 uid 可能与写入方不同）
            window.addEventListener("storage", (e) => {
                const keys = [
                    withThemeUid(THEME_MODE_KEY),
                    withThemeUid(THEME_STORAGE_KEY),
                    THEME_MODE_KEY,
                    THEME_STORAGE_KEY,
                ];
                if (!e.key || !keys.includes(e.key)) return;

                const saved = readSavedThemeMode();
                if (saved && themeMode.value !== saved) {
                    themeMode.value = saved;
                }
                applyTheme();
                notifyThemeChanged();
            });
        }
    };

    return {
        theme: isDark,
        themeMode,
        isDark: () => isDark.value,
        toggleTheme,
        setTheme,
        setThemeMode,
        initTheme
    };
}