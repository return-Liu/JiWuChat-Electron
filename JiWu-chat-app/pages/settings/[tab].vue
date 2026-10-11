<template>
  <div
    class="settings-page"
    :class="{ 'has-dynamic-bg': hasDynamicBackground }"
    :style="dynamicThemeStyle"
  >
    <DynamicBackground />

    <!-- 全局侧边栏导航（与消息 / 好友 / 账户中心保持一致） -->
    <Sidebar :current-area="'settings'" />

    <!-- 左侧边栏 -->
    <div class="settings-sidebar">
      <div class="sidebar-header">
        <div class="sidebar-brand">
          <div>
            <h2>极物聊天</h2>
            <p class="brand-subtitle">设置中心</p>
          </div>
        </div>
      </div>
      <div class="sidebar-menu">
        <div
          v-for="item in menuItems"
          :key="item.key"
          class="menu-item"
          :class="{ active: currentTab === item.key }"
          :style="{ '--menu-color': item.color }"
          @click="navigateTo(item.key)"
        >
          <i class="iconfont" :class="item.icon"></i>
          <span>{{ item.label }}</span>
        </div>
      </div>
    </div>

    <!-- 右侧主内容 -->
    <div class="settings-main">
      <div class="settings-content">
        <SettingsNotification v-show="currentTab === 'notification'" />
        <SettingsAppearance v-show="currentTab === 'appearance'" />
        <!-- 个性装扮持有 video / 观察器，用 v-if 真正卸载，避免切走后仍在后台占用资源 -->
        <SettingsSuperColorPalette v-if="currentTab === 'supercolorpalette'" />
        <SettingsPrivacy v-show="currentTab === 'privacy'" />
        <SettingsLanguage v-show="currentTab === 'language'" />
        <SettingsShortcut v-show="currentTab === 'shortcut'" />
        <SettingsFeature v-show="currentTab === 'feature'" />
        <SettingsSystem v-show="currentTab === 'system'" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch, ref } from "vue";
import { useRoute } from "#app";
import { useTheme, reloadThemeMode } from "../../composables/useTheme";
import { useDynamicBackground } from "../../composables/useDynamicBackground";
import { useDynamicThemeVars } from "../../composables/useDynamicThemeVars";
import { useSiderColor } from "../../stores/siderColor";
import { useUserStore } from "../../stores/user";
import SettingsNotification from "../../components/settings/SettingsNotification.vue";
import SettingsAppearance from "../../components/settings/SettingsAppearance.vue";
import SettingsSuperColorPalette from "../../components/settings/SettingsSuperColorPalette.vue";
import SettingsPrivacy from "../../components/settings/SettingsPrivacy.vue";
import SettingsLanguage from "../../components/settings/SettingsLanguage.vue";
import SettingsShortcut from "../../components/settings/SettingsShortcut.vue";
import SettingsFeature from "../../components/settings/SettingsFeature.vue";
import SettingsSystem from "../../components/settings/SettingsSystem.vue";

const route = useRoute();
const { hasDynamicBackground } = useDynamicBackground();

// 设置中心内容密集，动态主题下面板用半透明深底保证对比度
const { dynamicThemeStyle } = useDynamicThemeVars("dark");

// 支持浮层场景：从 props 接收 tab（浮层渲染时 route.params 为空）
const props = defineProps<{ tab?: string }>();

// 🔥 设置窗口是独立窗口，不走 layouts/default 的 initTheme：
//    明暗模式（含用户选定的夜间）必须在这里初始化，否则夜间模式不生效。
const siderColorStore = useSiderColor();
const userStore = useUserStore();
const { themeMode: currentThemeMode, initTheme: initThemeMode } = useTheme();

/** 当前主题模式对应的明暗（system 模式跟随系统偏好） */
const resolveIsDark = () =>
  currentThemeMode.value === "dark" ||
  (currentThemeMode.value === "system" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches);

/**
 * 把当前明暗落到 <html> 与 siderColor store。
 * 设置页的组件（面板底色 / 文字色票 / 侧边栏）分别依赖 html.dark 和 store 调色板，
 * 两者必须同时更新，否则会出现「已经切到夜间，设置组件还是日间配色」。
 */
const applyThemeToSettings = () => {
  const dark = resolveIsDark();
  document.documentElement.classList.toggle("dark", dark);
  siderColorStore.updateSystemPrefersDark(dark);
};

// 主题模式一变（本窗口切、其它窗口广播、system 切换）立即重新落地，不依赖初始化时机
watch(currentThemeMode, applyThemeToSettings);

// ===== 菜单配置 =====
const menuItems = [
  { key: "notification", label: "通知", icon: "icon-tongzhi", color: "#f59e0b" },
  { key: "appearance", label: "外观", icon: "icon-theme", color: "#8b5cf6" },
  { key: "supercolorpalette", label: "个性装扮", icon: "icon-pifu", color: "#8b5cf6" },
  { key: "privacy", label: "隐私", icon: "icon-yinsibaohu", color: "#3b82f6" },
  { key: "language", label: "语言", icon: "icon-yuyan", color: "#10b981" },
  { key: "shortcut", label: "快捷键", icon: "icon-kuaijiejian", color: "#ef4444" },
  { key: "feature", label: "新特性", icon: "icon-tianwenxue", color: "#ec4899" },
  { key: "system", label: "系统", icon: "icon-xitong", color: "#6366f1" },
];

// 当前 tab：优先从 props（浮层场景），其次 route.params（正常路由场景）
const currentTab = ref(props.tab || (route.params.tab as string) || "notification");

// 校验 tab 合法性，非法则回退默认
if (!menuItems.some((item) => item.key === currentTab.value)) {
  currentTab.value = "notification";
}

// 浏览器前进 / 后退时（popstate 导致 route.params.tab 变化）同步本地 tab，
// 这里只改本地状态，不再反向 push 路由，避免页面被重建
watch(
  () => route.params.tab,
  (v) => {
    if (props.tab) return;
    const key = String(v || "");
    if (key && key !== currentTab.value && menuItems.some((i) => i.key === key)) {
      currentTab.value = key;
    }
  },
);

// ===== 导航方法 =====
// 以本地 tab 状态为唯一数据源，地址栏用 history.replaceState 静默同步。
// ⚠️ 之前用 router.push 切 tab：Nuxt 会重建整个页面组件，壁纸视频重新加载、
//    所有 SettingsXxx 重新挂载，表现就是切换时闪一下白屏。
const navigateTo = (key: string) => {
  if (currentTab.value === key) return;
  currentTab.value = key;

  if (props.tab || typeof window === "undefined") return;
  try {
    window.history.replaceState(window.history.state, "", `/settings/${key}`);
  } catch {
    // 某些 Electron 子窗口 history 不可用，忽略即可（本地 tab 已经生效）
  }
};

// ===== 生命周期 =====
onMounted(async () => {
  // 1) 明暗模式最先初始化：注册跨窗口/系统的监听，并立即应用一次。
  //    不依赖网络：否则 initializeAuth 的请求一旦慢或失败，夜间模式就一直不生效。
  try {
    initThemeMode();
    applyThemeToSettings();
  } catch (err) {
    console.error("设置窗口初始化明暗模式失败:", err);
  }

  // 2) 初始化用户状态：触发 uiSettings.setCurrentUser → 加载该用户的字体设置。
  //    否则设置窗口里 currentUserId 为 null，字体保存到 legacy 键，与主窗口的 userId 键不匹配，
  //    导致「设置了字体，再打开就恢复默认」的 BUG。
  try {
    await userStore.initializeAuth();
    if (!userStore.user) {
      await userStore.fetchUserInfo(true);
    }
  } catch (err) {
    console.error("设置窗口初始化用户失败:", err);
  }

  // 3) 初始化侧边栏颜色主题（含跨窗口同步监听）
  try {
    await siderColorStore.initTheme();
  } catch (err) {
    console.error("设置窗口初始化主题失败:", err);
  }

  // 4) uid 就绪后存储键变为 theme_<uid>_*，重读一次明暗模式并应用（不会重复注册监听）
  reloadThemeMode();
  applyThemeToSettings();
});
</script>

<!-- 共享样式：非 scoped，可穿透到子组件 -->
<style lang="scss">
@import "../../assets/scss/settings-shared.scss";
</style>

<!-- 页面布局：scoped，仅作用于当前组件 -->
<style scoped lang="scss">
.settings-page {
  width: 100vw;
  height: 100vh;
  background: var(--bg-primary);
  display: flex;
  overflow: hidden;

  /* 个性装扮（动态背景）时，内容层浮在壁纸之上 */
  &.has-dynamic-bg > :not(.dynamic-bg-layer) {
    position: relative;
    z-index: 1;
  }

  /* 侧边栏悬浮卡片要始终盖在内容之上，否则会被同层内容遮住 */
  &.has-dynamic-bg .qq-sidebar {
    z-index: 2;
  }

  // 左侧边栏
  .settings-sidebar {
    width: 200px;
    min-width: 200px;
    background: var(--bg-secondary);
    display: flex;
    flex-direction: column;
    flex-shrink: 0;

    .sidebar-header {
      // 优化：增大上下间距，让品牌区更舒展
      padding: 24px 20px 20px;

      .sidebar-brand {
        display: flex;
        align-items: center;
        gap: 12px;

        h2 {
          margin: 0;
          font-size: 1.143rem;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.2;
        }

        .brand-subtitle {
          margin: 0;
          font-size: 0.786rem;
          color: var(--text-tertiary);
          letter-spacing: 0.3px;
        }
      }
    }

    .sidebar-menu {
      flex: 1;
      // 优化：上下留白更均衡，菜单项不会贴着 header
      padding: 12px 10px 16px;
      overflow-y: auto;

      .menu-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 9px 14px;
        border-radius: 6px;
        font-size: 1rem;
        color: var(--text-secondary);
        cursor: pointer;
        transition: all 0.15s;

        // 👇 关键：相邻菜单项之间留出间距，避免 hover/active 背景连成一片
        & + .menu-item {
          margin-top: 4px;
        }

        .iconfont {
          font-size: 1.286rem;
          color: var(--menu-color, var(--text-tertiary));
          transition:
            color 0.15s,
            transform 0.2s;
        }

        &.active {
          background: var(--bg-tertiary);
          color: var(--text-primary);
          font-weight: 500;

          .iconfont {
            color: var(--menu-color, var(--text-primary));
          }
        }

        &:hover:not(.active) {
          background: var(--bg-tertiary);
          color: var(--text-primary);
        }
      }
    }
  }

  // 右侧主内容
  .settings-main {
    flex: 1;
    overflow-y: auto;
    min-width: 0;
    background: var(--bg-primary);
    padding: 0 32px 40px;

    &::-webkit-scrollbar {
      width: 4px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--bg-tertiary);
      border-radius: 4px;
    }
  }

  .settings-content {
    max-width: 100%;
  }
}
</style>
