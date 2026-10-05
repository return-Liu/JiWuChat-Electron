<template>
  <div
    class="account-safe-page"
    :class="{ 'has-dynamic-bg': hasDynamicBackground }"
    :style="dynamicThemeStyle"
  >
    <!-- 个性装扮：动态背景层（视频 / 图片壁纸，铺满整个账户中心） -->
    <div v-if="hasDynamicBackground" class="safe-dynamic-bg">
      <video
        v-if="chatBgType === 'video' && chatBgVideo"
        ref="chatBgVideoRef"
        class="safe-dynamic-bg-media"
        :src="encodeURI(chatBgVideo)"
        muted
        loop
        autoplay
        playsinline
        preload="auto"
      ></video>
      <img
        v-else-if="chatBgType === 'image' && chatBgImage"
        class="safe-dynamic-bg-media"
        :src="chatBgImage"
        alt=""
      />
      <div class="safe-dynamic-bg-overlay" :style="{ background: chatBgOverlay }"></div>
    </div>

    <!-- 侧边栏导航（与其他主页面保持一致） -->
    <Sidebar :current-area="'user'" />

    <main class="safe-main">
      <div class="safe-shell">
        <!-- ========== 顶部：头像 + 身份信息 ========== -->
        <header class="hero">
          <div class="hero-avatar">
            <img :src="userAvatar" alt="头像" />
          </div>

          <div class="hero-text">
            <h1 class="hero-name">{{ displayName }}</h1>
            <p class="hero-sub">欢迎回来，这里可以管理你的账号与安全</p>
            <div class="hero-chips">
              <span class="chip">注册于 {{ registerDate || "--" }}</span>
              <span class="chip" :class="{ ok: isQQBound }">
                QQ {{ isQQBound ? "已绑定" : "未绑定" }}
              </span>
              <span class="chip">{{ mergedDevices.length }} 台设备</span>
            </div>
          </div>

          <button class="hero-edit" @click="handleEditProfile">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M4 20h4L18.5 9.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
              <path d="M13.5 6.5l3 3" />
            </svg>
            编辑资料
          </button>
        </header>

        <!-- ========== 全屏：账号安全评分 ========== -->
        <section class="score-bar">
          <div class="score-ring">
            <svg viewBox="0 0 80 80">
              <circle class="ring-track" cx="40" cy="40" :r="RING_RADIUS" />
              <circle
                class="ring-value"
                cx="40"
                cy="40"
                :r="RING_RADIUS"
                :stroke="securityColor"
                :stroke-dasharray="RING_CIRCUMFERENCE"
                :stroke-dashoffset="ringDashoffset"
              />
            </svg>
            <span class="score-num" :style="{ color: securityColor }">{{ securityScore }}</span>
          </div>

          <div class="score-text">
            <div class="score-title">
              账号安全评分
              <em :style="{ color: securityColor }">{{ securityLevelText }}</em>
            </div>
            <p class="score-desc">{{ securitySummary }}</p>
          </div>

          <div class="score-items">
            <span
              v-for="item in securityItems"
              :key="item.key"
              class="score-pill"
              :class="{ done: item.done }"
            >
              <i class="pill-dot"></i>
              {{ item.label }}
            </span>
          </div>
        </section>

        <!-- ========== 分段导航 ========== -->
        <nav class="seg">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="seg-btn"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            <svg
              v-if="tab.key === 'account'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="8.5" r="3.5" />
              <path d="M5 19.5a7 7 0 0 1 14 0" />
            </svg>
            <svg
              v-else-if="tab.key === 'security'"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 3.5l7 2.5v6c0 4-3 6.8-7 8.5-4-1.7-7-4.5-7-8.5v-6l7-2.5z" />
            </svg>
            <svg
              v-else
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="6" y="6" width="12" height="12" rx="2.5" />
              <path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3" />
            </svg>
            {{ tab.label }}
          </button>
        </nav>

        <!-- ========== 账号 ========== -->
        <section v-show="activeTab === 'account'" class="panel">
          <div class="block">
            <div class="block-head">
              <span class="block-title">安全设置</span>
            </div>

            <div class="row">
              <span class="row-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
                  <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
                </svg>
              </span>
              <span class="row-text">
                <span class="row-title">登录密码</span>
                <span class="row-desc">建议定期更换密码</span>
              </span>
              <span class="row-side">
                <span class="row-value">{{ passwordMask }}</span>
                <button class="act" @click="handleChangePassword">修改</button>
              </span>
            </div>

            <div class="row">
              <span class="row-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="7" y="3" width="10" height="18" rx="2.5" />
                  <path d="M11 18.5h2" />
                </svg>
              </span>
              <span class="row-text">
                <span class="row-title">手机号</span>
                <span class="row-desc">用于登录和找回密码</span>
              </span>
              <span class="row-side">
                <span class="row-value">{{ phone || "未绑定" }}</span>
                <button class="act" @click="handleChangePhone">修改</button>
              </span>
            </div>

            <div class="row">
              <span class="row-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="3" y="5.5" width="18" height="13" rx="2.5" />
                  <path d="m3.8 7.4 7.3 5.3a1.6 1.6 0 0 0 1.9 0L20.2 7.4" />
                </svg>
              </span>
              <span class="row-text">
                <span class="row-title">邮箱地址</span>
                <span class="row-desc">用于接收通知</span>
              </span>
              <span class="row-side">
                <span class="row-value">{{ email || "未绑定" }}</span>
                <button class="act" @click="handleChangeEmail">修改</button>
              </span>
            </div>
          </div>

          <div class="block">
            <div class="block-head">
              <span class="block-title">第三方绑定</span>
            </div>

            <div class="row">
              <span class="row-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M9.5 14.5l5-5" />
                  <path d="M13 7l1.8-1.8a3.6 3.6 0 0 1 5.1 5.1L18.5 11.7" />
                  <path d="M11 17l-1.8 1.8a3.6 3.6 0 0 1-5.1-5.1L5 12.3" />
                </svg>
              </span>
              <span class="row-text">
                <span class="row-title">QQ 账号</span>
                <span class="row-desc">使用 QQ 快速登录</span>
              </span>
              <span class="row-side">
                <span class="row-value" :class="{ ok: isQQBound }">
                  {{ isQQBound ? "已绑定" : "未绑定" }}
                </span>
                <button
                  v-if="!isQQBound"
                  class="act primary"
                  :disabled="qqBindingLoading"
                  @click="handleBindQQ"
                >
                  {{ qqBindingLoading ? "跳转中..." : "绑定" }}
                </button>
                <button v-else class="act danger" @click="handleUnbindQQ">解绑</button>
              </span>
            </div>
          </div>

          <div class="block">
            <div class="block-head">
              <span class="block-title">账号操作</span>
            </div>
            <div class="row row-danger" role="button" @click="handleLogout">
              <span class="row-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path
                    d="M15 8V6.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20h6a2.5 2.5 0 0 0 2.5-2.5V16"
                  />
                  <path d="M10 12h10m0 0l-3-3m3 3l-3 3" />
                </svg>
              </span>
              <span class="row-text">
                <span class="row-title">退出登录</span>
                <span class="row-desc">退出后需要使用密码重新登录</span>
              </span>
              <span class="row-icon row-chevron">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="m9 5 7 7-7 7" />
                </svg>
              </span>
            </div>
          </div>
        </section>

        <!-- ========== 安全管理 ========== -->
        <section v-show="activeTab === 'security'" class="panel">
          <div class="block">
            <div class="block-head">
              <span class="block-title">登录设备</span>
              <span class="block-extra">
                共 {{ mergedDevices.length }} 台<template
                  v-if="devices.length > mergedDevices.length"
                >
                  · {{ devices.length }} 个会话</template
                >
              </span>
            </div>

            <!-- 被踢设备又回来了：说明后端还没让它真正下线 -->
            <p v-if="reappearedHint" class="offline-hint">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 8v5M12 16h.01" />
              </svg>
              {{ reappearedHint }}
            </p>

            <div v-if="!mergedDevices.length" class="empty">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="4.5" width="18" height="12" rx="2.5" />
                <path d="M8.5 20.5h7M12 16.5v4" />
              </svg>
              <p>还没有其他登录设备</p>
            </div>

            <div
              v-for="device in mergedDevices"
              :key="device.key"
              class="row row-static"
              :class="{ 'is-current': device.isCurrentDevice }"
            >
              <span class="row-icon">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <rect x="3" y="4.5" width="18" height="12" rx="2.5" />
                  <path d="M8.5 20.5h7M12 16.5v4" />
                </svg>
              </span>
              <span class="row-text">
                <span class="row-title">
                  {{ device.deviceName }}
                  <em v-if="device.sessionCount > 1" class="session-badge">
                    {{ device.sessionCount }} 个会话
                  </em>
                </span>
                <span class="row-desc"> {{ device.os }} · {{ device.browser }} </span>
                <span class="row-desc">
                  登录于 {{ device.loginTime }} · {{ device.location }}
                </span>
              </span>
              <span class="row-side">
                <span v-if="device.isCurrentDevice" class="current-text">当前设备</span>
                <button
                  v-else
                  class="act danger"
                  :disabled="deviceKicking === device.key"
                  @click="handleLogoutDevice(device)"
                >
                  {{ deviceKicking === device.key ? "踢出中..." : "踢出" }}
                </button>
              </span>
            </div>
          </div>
        </section>

        <!-- ========== 系统 ========== -->
        <section v-show="activeTab === 'system'" class="panel">
          <div class="block">
            <div class="block-head">
              <span class="block-title">电池状态</span>
              <span class="block-extra" :class="{ ok: batteryCharging }">
                {{ batteryCharging ? "充电中" : "使用电池" }}
              </span>
            </div>

            <div class="batt">
              <div class="batt-head">
                <span class="batt-num" :style="batteryPercentageStyle">
                  {{ batteryLevel }}<i>%</i>
                </span>
                <span class="batt-tag">{{ batteryLevelText }}</span>
              </div>

              <div class="batt-bar">
                <div
                  class="batt-fill"
                  :class="batteryLevelClass"
                  :style="{ width: batteryLevel + '%' }"
                ></div>
              </div>

              <div class="kv">
                <span class="kv-label">当前状态</span>
                <span class="kv-value" :class="{ ok: batteryCharging }">
                  {{ batteryCharging ? "正在充电" : "未充电" }}
                </span>
              </div>
              <div v-if="batterySupport" class="kv">
                <span class="kv-label">
                  {{ batteryCharging ? "预计充满" : "剩余可用" }}
                </span>
                <span class="kv-value">
                  {{ batteryCharging ? batteryChargingTime : batteryDischargingTime }}
                </span>
              </div>
              <div v-else class="kv">
                <span class="kv-label">设备信息</span>
                <span class="kv-value">暂不支持获取</span>
              </div>
              <div class="kv">
                <span class="kv-label">电量等级</span>
                <span class="kv-value">{{ batteryLevelText }}</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "../../stores/user";
import { useDynamicBackground } from "../../composables/useDynamicBackground";
import { useDynamicThemeVars } from "../../composables/useDynamicThemeVars";
import { message, Modal } from "ant-design-vue";
import request from "../../untils/request";

const router = useRouter();
const userStore = useUserStore();

// 个性装扮：动态背景（视频 / 图片壁纸）+ 从壁纸吸取主色
const {
  hasDynamicBackground,
  chatBgType,
  chatBgVideo,
  chatBgImage,
  chatBgOverlay,
  chatBgVideoRef,
} = useDynamicBackground();

// 个性装扮下：面板透明透出壁纸、文字转白、主色改用壁纸吸取色
const { dynamicThemeStyle } = useDynamicThemeVars("light");

// ========== Tab 配置 ==========
const tabs = [
  { key: "account", label: "账号" },
  { key: "security", label: "安全管理" },
  { key: "system", label: "系统" },
];
const activeTab = ref("account");

// ========== 用户信息 ==========
const username = ref("");
const registerDate = ref("");
const email = ref("");
const phone = ref("");
const userId = ref("");

const userAvatar = computed(() => {
  return userStore.userAvatar || userStore.user?.avatar || "";
});

const displayName = computed(() => {
  return username.value || "未设置昵称";
});

// 密码掩码：始终显示为圆点，不暴露真实密文
const passwordMask = computed(() => "••••••••");

// ========== QQ绑定 ==========
const isQQBound = ref(false);
const qqBindingLoading = ref(false);

// ========== 安全评分 ==========
const securityItems = computed(() => [
  { key: "password", label: "登录密码", done: true },
  { key: "phone", label: "手机验证", done: !!phone.value },
  { key: "email", label: "邮箱验证", done: !!email.value },
  { key: "qq", label: "社交账号", done: isQQBound.value },
]);

const RING_RADIUS = 30;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const securityScore = computed(() => {
  const items = securityItems.value;
  if (!items.length) return 0;
  return Math.round((items.filter((i) => i.done).length / items.length) * 100);
});

const securityLevelText = computed(() => {
  const score = securityScore.value;
  if (score >= 100) return "安全等级：满分";
  if (score >= 75) return "安全等级：优秀";
  if (score >= 50) return "安全等级：良好";
  return "安全等级：待提升";
});

const securityColor = computed(() => {
  const score = securityScore.value;
  if (score >= 75) return "#22c55e";
  if (score >= 50) return "#fbbf24";
  return "#f87171";
});

const securityTodoLabels = computed(() =>
  securityItems.value.filter((i) => !i.done).map((i) => i.label),
);

const securitySummary = computed(() => {
  const score = securityScore.value;
  if (score >= 100) return "您的账号安全措施完善，请继续保持";
  if (score >= 75) return "您的账号安全性良好，建议完善剩余安全设置";
  if (score >= 50) return "您的账号存在安全隐患，建议及时完善安全设置";
  return "您的账号存在严重安全隐患，请立即完善安全设置";
});
const ringDashoffset = computed(() => RING_CIRCUMFERENCE * (1 - securityScore.value / 100));

// ========== 设备管理 ==========
interface Device {
  id: number;
  deviceName: string;
  deviceType: string;
  os: string;
  browser: string;
  ipAddress: string;
  location: string;
  loginTime: string;
  isCurrentDevice: boolean;
}

const devices = ref<Device[]>([]);
const deviceKicking = ref("");

// 同一台机器（同名称 + 同系统 + 同浏览器）在后端会被记成多条会话，
// 展示时合并为一行，踢出时把这些会话一起清掉。
interface MergedDevice {
  key: string;
  ids: number[];
  deviceName: string;
  os: string;
  browser: string;
  ipAddress: string;
  location: string;
  loginTime: string;
  isCurrentDevice: boolean;
  sessionCount: number;
}

const mergedDevices = computed<MergedDevice[]>(() => {
  const map = new Map<string, MergedDevice>();
  for (const d of devices.value) {
    const key = `${d.deviceName}|${d.os}|${d.browser}`;
    const hit = map.get(key);
    if (!hit) {
      map.set(key, {
        key,
        ids: [d.id],
        deviceName: d.deviceName,
        os: d.os,
        browser: d.browser,
        ipAddress: d.ipAddress,
        location: d.location,
        loginTime: d.loginTime,
        isCurrentDevice: d.isCurrentDevice,
        sessionCount: 1,
      });
      continue;
    }
    hit.ids.push(d.id);
    hit.sessionCount += 1;
    if (d.isCurrentDevice) hit.isCurrentDevice = true;
    // 展示最近一次登录的信息
    if ((d.loginTime || "") > (hit.loginTime || "")) {
      hit.loginTime = d.loginTime;
      hit.ipAddress = d.ipAddress;
      hit.location = d.location;
    }
  }
  return [...map.values()];
});

// 已踢出过的机器标识：刷新后若还在列表里，说明它又连回来了
const kickedKeys = ref<string[]>([]);
const reappearedKeys = computed(() =>
  kickedKeys.value.filter((key) => mergedDevices.value.some((d) => d.key === key)),
);
const reappearedHint = computed(() => {
  if (!reappearedKeys.value.length) return "";
  const name = mergedDevices.value.find((d) => d.key === reappearedKeys.value[0])?.deviceName;
  return `${name || "该设备"}又出现在列表里：踢出已经让它强制下线了，只有在这台设备上重新登录才会再次出现。`;
});

// ========== 电池相关 ==========
const batteryLevel = ref(100);
const batteryCharging = ref(false);
const batterySupport = ref(false);
const batteryDischargingTime = ref("--");
const batteryChargingTime = ref("--");
let batteryInstance: any = null;

const batteryLevelClass = computed(() => {
  if (batteryCharging.value) return "charging";
  if (batteryLevel.value <= 20) return "low";
  if (batteryLevel.value <= 50) return "medium";
  return "high";
});

const batteryLevelText = computed(() => {
  const level = batteryLevel.value;
  if (level <= 20) return "低电量";
  if (level <= 50) return "中等";
  if (level <= 80) return "良好";
  return "充足";
});

const batteryPercentageStyle = computed(() => {
  if (batteryCharging.value) return { color: "#22c55e" };
  const level = batteryLevel.value;
  if (level <= 20) return { color: "#f87171" };
  if (level <= 50) return { color: "#fb923c" };
  if (level <= 80) return { color: "#fbbf24" };
  return { color: "#4ade80" };
});

const formatTime = (seconds: number): string => {
  if (!seconds || seconds === Infinity || seconds <= 0) return "--";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0 && minutes > 0) return `${hours} 小时 ${minutes} 分`;
  if (hours > 0) return `${hours} 小时`;
  if (minutes > 0) return `${minutes} 分钟`;
  return "不到 1 分钟";
};

const updateBatteryInfo = () => {
  if (!batteryInstance) return;
  try {
    batteryLevel.value = Math.round(batteryInstance.level * 100);
    batteryCharging.value = batteryInstance.charging;

    if (batteryInstance.charging) {
      const t = batteryInstance.chargingTime;
      batteryChargingTime.value = t && t !== Infinity && t > 0 ? formatTime(t) : "计算中";
      batteryDischargingTime.value = "--";
    } else {
      const t = batteryInstance.dischargingTime;
      batteryDischargingTime.value = t && t !== Infinity && t > 0 ? formatTime(t) : "--";
      batteryChargingTime.value = "--";
    }
  } catch (error) {
    console.error("更新电池信息失败:", error);
  }
};

const getBatteryInfo = async () => {
  try {
    if (!("getBattery" in navigator)) {
      batterySupport.value = false;
      return;
    }
    const battery = await (navigator as any).getBattery();
    batteryInstance = battery;
    batterySupport.value = true;
    updateBatteryInfo();

    ["levelchange", "chargingchange", "chargingtimechange", "dischargingtimechange"].forEach(
      (event) => {
        battery.addEventListener(event, updateBatteryInfo);
      },
    );
  } catch (error) {
    console.error("获取电池信息失败:", error);
    batterySupport.value = false;
  }
};

// ========== API 请求 ==========
const fetchUserInfo = async () => {
  try {
    await userStore.fetchUserInfo();
    if (userStore.user) {
      email.value = userStore.user.email || "";
      username.value = userStore.user.nickname || userStore.user.username || "";
      phone.value = userStore.user.phone || "";
      userId.value = String(userStore.user.id || "");
      if (userStore.user.createdAt) {
        const date = new Date(userStore.user.createdAt);
        registerDate.value = date.toISOString().split("T")[0];
      }
    }
  } catch (error) {
    console.error("获取用户信息失败:", error);
  }
};

const fetchQQBindingStatus = async () => {
  try {
    const res = await request.get("/auth/qq/binding-status");
    if (res.data) {
      isQQBound.value = res.data.isQQBound ?? false;
    }
  } catch (error) {
    console.error("获取QQ绑定状态失败:", error);
  }
};

const fetchDevices = async () => {
  try {
    const res = await request.get("/auth/devices");
    if (res.data?.devices) {
      devices.value = (res.data.devices || []).map((d: any) => ({
        id: d.id,
        deviceName: d.deviceName || "未知设备",
        deviceType: d.deviceType || "web",
        os: d.osName ? `${d.osName} ${d.osVersion || ""}` : "未知系统",
        // 只显示浏览器名称，不显示版本号（如 Chrome 154.0.0.0 → Chrome）
        browser: d.browserName || "未知浏览器",
        ipAddress: d.ipAddress || "未知",
        location: d.location || "未知位置",
        loginTime: d.loginTime || "",
        isCurrentDevice: d.isCurrentDevice ?? false,
      }));
    }
  } catch (error) {
    console.error("获取设备列表失败:", error);
  }
};

// ========== 事件处理 ==========
const handleEditProfile = () => {
  // 与「个人账号管理」保持一致：资料编辑收在左侧边栏的头像名片里
  message.info("请点击左侧边栏头像，在弹窗中编辑资料");
};

const handleChangePassword = () => {
  router.push("/forgot-password");
};

const handleChangePhone = () => {
  message.info("修改手机号功能开发中");
};

const handleChangeEmail = () => {
  message.info("修改邮箱功能开发中");
};

const handleBindQQ = () => {
  qqBindingLoading.value = true;
  const backendUrl = process.env.NUXT_PUBLIC_API_BASE_URL || "http://localhost:8080";
  window.location.href = `${backendUrl}/auth/qq/bind`;
};

const handleUnbindQQ = () => {
  Modal.confirm({
    title: "确认解绑QQ",
    content: "解绑后你将无法使用QQ快捷登录，确定要解绑吗？",
    okText: "确认解绑",
    cancelText: "取消",
    okType: "danger",
    onOk: async () => {
      try {
        const response = await request.delete("/auth/qq/unbind");
        isQQBound.value = false;
        message.success(response.data?.message || "解绑成功");
      } catch (error: any) {
        message.error(error?.response?.data?.message || "解绑失败，请重试");
      }
    },
  });
};

const handleLogoutDevice = (device: MergedDevice) => {
  const extra =
    device.sessionCount > 1 ? `　这台设备有 ${device.sessionCount} 个会话，会一并踢出。` : "";
  Modal.confirm({
    title: "确认踢出设备",
    content: `确定要踢出「${device.deviceName}」吗？${extra}`,
    okText: "确认踢出",
    cancelText: "取消",
    okType: "danger",
    onOk: async () => {
      deviceKicking.value = device.key;
      try {
        // 同一台机器的多个会话逐个删除，失败不影响其他会话
        const results = await Promise.allSettled(
          device.ids.map((id) => request.delete(`/auth/devices/${id}`)),
        );
        const failed = results.filter((r) => r.status === "rejected").length;
        if (failed && failed === device.ids.length) {
          message.error("踢出失败，请重试");
          return;
        }
        message.success(failed ? `踢出完成，${failed} 个会话删除失败` : "已踢出该设备");
        // 立刻移除，再拉一次真实列表：如果该设备重新联网又回来，会显示提示
        devices.value = devices.value.filter((d) => !device.ids.includes(d.id));
        if (!kickedKeys.value.includes(device.key)) {
          kickedKeys.value = [...kickedKeys.value, device.key];
        }
        setTimeout(() => fetchDevices(), 800);
      } catch (error: any) {
        message.error(error?.response?.data?.message || "操作失败，请重试");
      } finally {
        deviceKicking.value = "";
      }
    },
  });
};

const handleLogout = () => {
  Modal.confirm({
    title: "确认退出",
    content: "确定要退出登录吗？",
    okText: "确认退出",
    cancelText: "取消",
    okType: "danger",
    onOk() {
      userStore.logout();
      router.push("/login");
    },
  });
};

// ========== 生命周期 ==========
onBeforeUnmount(() => {
  if (batteryInstance) {
    ["levelchange", "chargingchange", "chargingtimechange", "dischargingtimechange"].forEach(
      (event) => {
        batteryInstance.removeEventListener(event, updateBatteryInfo);
      },
    );
    batteryInstance = null;
  }
});

onMounted(() => {
  getBatteryInfo();
  fetchUserInfo();
  fetchQQBindingStatus();
  fetchDevices();
});
</script>

<style lang="scss" scoped>
.account-safe-page {
  width: 100vw;
  height: 100vh;
  background: var(--bg-primary);
  display: flex;
  overflow: hidden;

  /* 个性装扮（动态背景）时，内容层浮在壁纸之上 */
  &.has-dynamic-bg > :not(.safe-dynamic-bg) {
    position: relative;
    z-index: 1;
  }

  /* 侧边栏悬浮卡片要始终盖在内容之上，否则会被同层内容遮住 */
  &.has-dynamic-bg .qq-sidebar {
    z-index: 2;
  }

  /* ===== 动态背景层（视频 / 图片壁纸） ===== */
  .safe-dynamic-bg {
    position: absolute;
    inset: 0;
    z-index: 0;
    overflow: hidden;
    pointer-events: none;
    /* 独立合成层 + 硬件加速；不使用 contain / will-change，避免视频循环时合成层重建导致闪动 */
    transform: translateZ(0);
  }

  .safe-dynamic-bg-media {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    user-select: none;
    transform: translateZ(0);
    backface-visibility: hidden;
  }

  .safe-dynamic-bg-overlay {
    position: absolute;
    inset: 0;
    z-index: 1;
  }
}

.safe-main {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

/* 全屏铺开：不再限定宽度，也不做水平居中 */
.safe-shell {
  width: 100%;
  min-width: 0;
  padding: 40px 48px 72px;
}

/* ========== 顶部身份区 ========== */
.hero {
  display: flex;
  align-items: center;
  gap: 20px;
  padding-bottom: 28px;
}

.hero-avatar {
  width: 78px;
  height: 78px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  box-shadow: 0 0 0 1px var(--border-color);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

.hero-text {
  flex: 1;
  min-width: 0;
}

.hero-name {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.4px;
  color: var(--text-primary);
}

.hero-sub {
  margin: 5px 0 0;
  font-size: 13px;
  color: var(--text-tertiary);
}

.hero-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.chip {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 1.5;
  white-space: nowrap;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);

  &.ok {
    color: #16a34a;
    border-color: rgba(34, 197, 94, 0.35);
    background: rgba(34, 197, 94, 0.1);
  }
}

.hero-edit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 9px 16px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s;

  svg {
    width: 15px;
    height: 15px;
  }

  &:hover {
    color: var(--color-brand);
    border-color: var(--color-brand);
    background: var(--color-brand-light, rgba(59, 130, 246, 0.06));
  }
}

/* ========== 全屏：账号安全评分 ========== */
.score-bar {
  display: flex;
  align-items: center;
  gap: 22px;
  width: 100%;
  padding: 18px 0;
  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);
  margin-bottom: 26px;
}

.score-ring {
  position: relative;
  width: 84px;
  height: 84px;
  flex-shrink: 0;

  svg {
    display: block;
    width: 100%;
    height: 100%;
  }
}

.ring-track {
  fill: none;
  stroke: var(--border-color);
  stroke-width: 6;
}

.ring-value {
  fill: none;
  stroke-width: 6;
  stroke-linecap: round;
  // 从 12 点方向开始画
  transform: rotate(-90deg);
  transform-box: fill-box;
  transform-origin: center;
  transition:
    stroke-dashoffset 0.9s cubic-bezier(0.4, 0, 0.2, 1),
    stroke 0.3s ease;
}

.score-num {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 25px;
  font-weight: 700;
  letter-spacing: -0.8px;
}

.score-text {
  flex: 1;
  min-width: 0;
}

.score-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);

  em {
    padding: 2px 9px;
    border-radius: 8px;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    background: var(--bg-secondary);
  }
}

.score-desc {
  margin: 5px 0 0;
  font-size: 12.5px;
  color: var(--text-tertiary);
}

.score-items {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  flex: 0 1 auto;
  min-width: 0;
}

.score-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 5px 13px;
  border-radius: 999px;
  font-size: 12px;
  color: var(--text-tertiary);
  border: 1px solid var(--border-color);
  white-space: nowrap;

  &.done {
    color: #16a34a;
    border-color: rgba(34, 197, 94, 0.35);
  }
}

.pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--error-color);
  flex-shrink: 0;

  .score-pill.done & {
    background: #22c55e;
  }
}

/* ========== 分段导航（下划线式，去掉胶囊） ========== */
.seg {
  position: relative;
  display: flex;
  gap: 28px;
  width: fit-content;
  margin-bottom: 30px;
  border-bottom: 1px solid var(--border-color);
}

.seg-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 4px;
  white-space: nowrap;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14.5px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.2s;

  svg {
    width: 16px;
    height: 16px;
  }

  &:hover {
    color: var(--text-primary);
  }

  &.active {
    color: var(--color-brand);
    font-weight: 600;

    // 底部下划线
    &::after {
      content: "";
      position: absolute;
      left: 0;
      right: 0;
      bottom: -1px;
      height: 2px;
      border-radius: 2px;
      background: var(--color-brand);
    }
  }
}

.seg-badge {
  min-width: 18px;
  padding: 0 6px;
  font-size: 11px;
  font-style: normal;
  font-weight: 600;
  line-height: 18px;
  color: #fff;
  background: var(--error-color);
  border-radius: 9px;
}

/* ========== 区块 ========== */
.panel {
  animation: panel-in 0.28s ease;
}

@keyframes panel-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

.block {
  margin-bottom: 34px;

  &:last-child {
    margin-bottom: 0;
  }
}

.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-color);
}

.block-title {
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: var(--text-secondary);
}

.block-extra {
  font-size: 12.5px;
  color: var(--text-tertiary);

  &.ok {
    color: #16a34a;
    font-weight: 500;
  }
}

/* ========== 通栏列表行 ========== */
.row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 12px;
  margin: 0 -12px;
  border-radius: 12px;
  transition: background 0.18s;

  // 行分隔线：贴在下一行顶部，避免最后一行多出一条线
  & + .row {
    box-shadow: inset 0 1px 0 var(--border-color);
  }

  &:hover {
    background: var(--bg-hover);
  }
}

.row-static:hover {
  background: transparent;
}

.row-icon {
  display: inline-flex;
  flex-shrink: 0;
  color: var(--text-tertiary);

  svg {
    width: 19px;
    height: 19px;
  }
}

.row-chevron svg {
  width: 16px;
  height: 16px;
}

.row-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.row-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14.5px;
  font-weight: 500;
  color: var(--text-primary);
}

.row-desc {
  margin-top: 2px;
  font-size: 12.5px;
  color: var(--text-tertiary);
}

.row-side {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.row-value {
  font-size: 13.5px;
  color: var(--text-secondary);

  &.ok {
    color: #16a34a;
    font-weight: 500;
  }
}

// 「当前设备」：无边框无背景，只有文字，水平垂直居中于右侧操作位
.current-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  // 与「踢出」按钮等宽，保证各行右端对齐
  min-width: 76px;
  padding: 6px 4px;
  font-size: 13px;
  font-weight: 500;
  color: var(--color-brand);
  background: transparent;
  border: none;
  white-space: nowrap;
}

.session-badge {
  padding: 2px 8px;
  font-size: 11px;
  font-style: normal;
  font-weight: 500;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  white-space: nowrap;
}

/* 设备被踢后又回来：说明后端没让它真正下线 */
.offline-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 14px 0 0;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);

  svg {
    width: 16px;
    height: 16px;
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--error-color);
  }
}

.row.is-current .row-title {
  color: var(--color-brand);
}

/* 危险行：退出登录 */
.row-danger {
  cursor: pointer;

  .row-icon,
  .row-title {
    color: var(--error-color);
  }

  &:hover {
    background: rgba(239, 68, 68, 0.06);
  }
}

/* ========== 操作按钮 ========== */
.act {
  padding: 6px 15px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.16s;

  &:hover {
    color: var(--color-brand);
    border-color: var(--color-brand);
    background: var(--color-brand-light, rgba(59, 130, 246, 0.06));
  }

  &.primary {
    border-color: transparent;
    background: var(--color-brand);
    color: #fff;

    &:hover {
      background: var(--color-brand-hover);
      color: #fff;
    }

    &:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
  }

  &.danger {
    border-color: var(--error-color);
    color: var(--error-color);

    &:hover {
      color: var(--error-color);
      background: rgba(239, 68, 68, 0.08);
    }
  }
}

/* ========== 空状态 ========== */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 44px 0;
  color: var(--text-tertiary);

  svg {
    width: 34px;
    height: 34px;
    opacity: 0.55;
  }

  p {
    margin: 0;
    font-size: 13px;
  }
}

/* ========== 电池 ========== */
.batt {
  padding: 18px 12px 4px;
  margin: 0 -12px;
}

.batt-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 14px;
}

.batt-num {
  font-size: 44px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: -2px;

  i {
    font-size: 18px;
    font-style: normal;
    font-weight: 600;
    margin-left: 2px;
    opacity: 0.6;
  }
}

.batt-tag {
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 8px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
}

.batt-bar {
  position: relative;
  width: 100%;
  height: 8px;
  margin-bottom: 18px;
  border-radius: 999px;
  background: var(--bg-hover);
  overflow: hidden;
}

.batt-fill {
  position: relative;
  height: 100%;
  border-radius: 999px;
  transition: width 0.6s ease;
  overflow: hidden;

  &.high {
    background: #4ade80;
  }
  &.medium {
    background: #fbbf24;
  }
  &.low {
    background: #f87171;
  }

  &.charging {
    background: linear-gradient(
      90deg,
      #22c55e 0%,
      #4ade80 25%,
      #86efac 50%,
      #4ade80 75%,
      #22c55e 100%
    );
    background-size: 200% 100%;
    animation: bar-flow 2s linear infinite;

    &::before {
      content: "";
      position: absolute;
      inset: 0;
      background: linear-gradient(
        100deg,
        transparent 30%,
        rgba(255, 255, 255, 0.65) 50%,
        transparent 70%
      );
      transform: translateX(-100%);
      animation: bar-sheen 1.8s ease-in-out infinite;
    }

    &::after {
      content: "";
      position: absolute;
      inset: 0;
      background-image:
        radial-gradient(
          circle at 10px 0,
          rgba(255, 255, 255, 0.45) 0,
          rgba(255, 255, 255, 0.45) 6px,
          transparent 7px
        ),
        radial-gradient(
          circle at 30px 0,
          rgba(255, 255, 255, 0.35) 0,
          rgba(255, 255, 255, 0.35) 6px,
          transparent 7px
        );
      background-size: 40px 100%;
      background-repeat: repeat-x;
      animation: bar-wave 1.6s linear infinite;
      mix-blend-mode: overlay;
    }
  }
}

.kv {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 0;
  box-shadow: inset 0 1px 0 var(--border-color);

  &:first-of-type {
    box-shadow: none;
  }
}

.kv-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.kv-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);

  &.ok {
    color: #16a34a;
  }
}

@keyframes bar-flow {
  0% {
    background-position: 0% 50%;
  }
  100% {
    background-position: 200% 50%;
  }
}

@keyframes bar-sheen {
  0% {
    transform: translateX(-100%);
  }
  60%,
  100% {
    transform: translateX(100%);
  }
}

@keyframes bar-wave {
  0% {
    background-position-x: 0;
  }
  100% {
    background-position-x: 40px;
  }
}

/* ========== 个性装扮（动态背景）下的可读性增强 ========== */
.account-safe-page.has-dynamic-bg {
  .hero-name,
  .hero-sub,
  .chip,
  .block-title,
  .block-extra,
  .row-title,
  .row-desc,
  .row-value,
  .kv-label,
  .kv-value,
  .batt-num,
  .batt-tag,
  .empty p,
  .seg-btn,
  .score-num,
  .score-title,
  .score-desc,
  .score-pill,
  .current-text {
    text-shadow:
      0 1px 3px rgba(0, 0, 0, 0.75),
      0 0 8px rgba(0, 0, 0, 0.5);
  }

  // 评分环 + 胶囊：换成半透明深底，保证在壁纸上看得清
  .ring-track {
    stroke: rgba(255, 255, 255, 0.24);
  }

  .score-title em,
  .score-pill {
    background: rgba(0, 0, 0, 0.28);
    border-color: rgba(255, 255, 255, 0.26);
    color: rgba(255, 255, 255, 0.92);
  }

  .score-pill.done {
    color: #86efac;
    border-color: rgba(134, 239, 172, 0.45);
  }

  .session-badge,
  .offline-hint {
    background: rgba(0, 0, 0, 0.28);
    border-color: rgba(255, 255, 255, 0.26);
    color: rgba(255, 255, 255, 0.92);
  }

  // 容器不再用浅色卡片，改用半透明深底
  .chip,
  .batt-tag {
    background: rgba(0, 0, 0, 0.28);
    border-color: rgba(255, 255, 255, 0.26);
    color: rgba(255, 255, 255, 0.92);
  }

  .chip.ok,
  .row-value.ok,
  .kv-value.ok,
  .block-extra.ok {
    color: #86efac;
  }

  .act,
  .hero-edit {
    background: rgba(0, 0, 0, 0.26);
    border-color: rgba(255, 255, 255, 0.28);
    color: rgba(255, 255, 255, 0.92);

    &:hover {
      background: rgba(0, 0, 0, 0.4);
      border-color: rgba(255, 255, 255, 0.55);
      color: #fff;
    }
  }

  .act.primary:hover {
    background: rgba(0, 0, 0, 0.45);
  }

  .batt-bar {
    background: rgba(0, 0, 0, 0.3);
  }

  .row-danger:hover {
    background: rgba(248, 113, 113, 0.22);
  }

  .row:hover,
  .row.is-current:hover {
    background: rgba(255, 255, 255, 0.12);
  }
}

/* ========== 响应式 ========== */
@media (max-width: 1100px) {
  .score-bar {
    flex-wrap: wrap;
  }

  .score-items {
    justify-content: flex-start;
    max-width: none;
    width: 100%;
    padding-left: 106px;
  }
}

@media (max-width: 900px) {
  .safe-shell {
    padding: 28px 22px 56px;
  }
}

@media (max-width: 640px) {
  .hero {
    flex-wrap: wrap;
  }

  .hero-edit {
    width: 100%;
    justify-content: center;
  }

  .seg {
    width: 100%;
  }

  .seg-btn {
    min-width: 0;
    flex: 1;
    padding: 10px 8px;
    font-size: 13px;
  }

  .seg-btn svg {
    display: none;
  }

  .score-items {
    padding-left: 0;
  }

  .row {
    flex-wrap: wrap;
  }

  .row-side {
    width: 100%;
    justify-content: flex-end;
    padding-left: 33px;
  }

  .batt-num {
    font-size: 36px;
  }
}
</style>
