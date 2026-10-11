<template>
  <div
    class="account-safe-page"
    :class="{ 'has-dynamic-bg': hasDynamicBackground }"
    :style="dynamicThemeStyle"
  >
    <DynamicBackground />

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
                <i class="chip-dot"></i>
                QQ {{ isQQBound ? "已绑定" : "未绑定" }}
              </span>
              <span class="chip">
                <i class="chip-dot neutral"></i>
                {{ mergedDevices.length }} 台设备
              </span>
            </div>
          </div>

          <button class="hero-edit" @click="handleEditProfile">
            <EditOutlined />
            编辑资料
          </button>
        </header>

        <!-- ========== 账号安全评分卡片 ========== -->
        <section class="score-card">
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
              <em :style="{ color: securityColor, background: securityColorSoft }">
                {{ securityLevelText }}
              </em>
            </div>
            <p class="score-desc">{{ securitySummary }}</p>

            <!-- 只显示待办项；全部完成时不渲染 -->
            <p v-if="securityTodoLabels.length" class="score-todo">
              <span class="score-todo-label">待完善</span>
              <span class="score-todo-items">{{ securityTodoLabels.join(" · ") }}</span>
              <button class="score-todo-link" @click="activeTab = 'account'">去完善</button>
            </p>
          </div>
        </section>

        <!-- ========== 分段导航（胶囊 Tab） ========== -->
        <nav class="seg">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="seg-btn"
            :class="{ active: activeTab === tab.key }"
            @click="activeTab = tab.key"
          >
            <UserOutlined v-if="tab.key === 'account'" />
            <SafetyCertificateOutlined v-else-if="tab.key === 'security'" />
            <SettingOutlined v-else />
            {{ tab.label }}
          </button>
        </nav>

        <!-- ========== 账号 ========== -->
        <section v-show="activeTab === 'account'" class="panel">
          <div class="card">
            <div class="block-head">
              <span class="block-title">安全设置</span>
            </div>

            <div class="row">
              <span class="row-icon">
                <LockOutlined />
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
                <MobileOutlined />
              </span>
              <span class="row-text">
                <span class="row-title">手机号</span>
                <span class="row-desc">用于登录和找回密码</span>
              </span>
              <span class="row-side">
                <span class="row-value" :class="{ 'is-empty': !phone }">
                  {{ phone || "未绑定" }}
                </span>
                <button class="act" @click="handleChangePhone">修改</button>
              </span>
            </div>

            <div class="row">
              <span class="row-icon">
                <MailOutlined />
              </span>
              <span class="row-text">
                <span class="row-title">邮箱地址</span>
                <span class="row-desc">用于接收通知</span>
              </span>
              <span class="row-side">
                <span class="row-value" :class="{ 'is-empty': !email }">
                  {{ email || "未绑定" }}
                </span>
                <button class="act" @click="handleChangeEmail">修改</button>
              </span>
            </div>
          </div>

          <div class="card">
            <div class="block-head">
              <span class="block-title">第三方绑定</span>
            </div>

            <div class="row">
              <span class="row-icon">
                <LinkOutlined />
              </span>
              <span class="row-text">
                <span class="row-title">QQ 账号</span>
                <span class="row-desc">使用 QQ 快速登录</span>
              </span>
              <span class="row-side">
                <span class="row-value" :class="{ ok: isQQBound, 'is-empty': !isQQBound }">
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

          <!-- 危险操作独立卡片 -->
          <div class="card card-danger">
            <div class="block-head">
              <span class="block-title">账号操作</span>
            </div>
            <div class="row row-danger" role="button" @click="handleLogout">
              <span class="row-icon">
                <LogoutOutlined />
              </span>
              <span class="row-text">
                <span class="row-title">退出登录</span>
                <span class="row-desc">退出后需要使用密码重新登录</span>
              </span>
              <span class="row-icon row-chevron">
                <RightOutlined />
              </span>
            </div>
          </div>
        </section>

        <!-- ========== 安全管理 ========== -->
        <section v-show="activeTab === 'security'" class="panel">
          <div class="card">
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

            <p v-if="reappearedHint" class="offline-hint">
              <ExclamationCircleOutlined />
              {{ reappearedHint }}
            </p>

            <div v-if="!mergedDevices.length" class="empty">
              <DesktopOutlined />
              <p>还没有其他登录设备</p>
            </div>

            <div
              v-for="device in mergedDevices"
              :key="device.key"
              class="device-row"
              :class="{ 'is-current': device.isCurrentDevice }"
            >
              <span class="device-icon">
                <DesktopOutlined />
              </span>

              <div class="device-info">
                <div class="device-name">
                  <span class="device-name-text">{{ device.deviceName }}</span>
                  <em v-if="device.sessionCount > 1" class="session-badge">
                    {{ device.sessionCount }} 个会话
                  </em>
                </div>
                <div class="device-meta">
                  <span>{{ device.os }}</span>
                  <i class="meta-dot"></i>
                  <span>{{ device.browser }}</span>
                </div>
                <div class="device-meta is-sub">
                  <span>登录于 {{ device.loginTime }}</span>
                  <i class="meta-dot"></i>
                  <span>{{ device.location }}</span>
                </div>
              </div>

              <div class="device-action">
                <span v-if="device.isCurrentDevice" class="current-text">当前设备</span>
                <button
                  v-else
                  class="act danger"
                  :disabled="deviceKicking === device.key"
                  @click="handleLogoutDevice(device)"
                >
                  {{ deviceKicking === device.key ? "踢出中..." : "踢出" }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- ========== 系统 ========== -->
        <section v-show="activeTab === 'system'" class="panel">
          <div class="card">
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
import {
  EditOutlined,
  UserOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  LockOutlined,
  MobileOutlined,
  MailOutlined,
  LinkOutlined,
  LogoutOutlined,
  RightOutlined,
  ExclamationCircleOutlined,
  DesktopOutlined,
} from "@ant-design/icons-vue";

const router = useRouter();
const userStore = useUserStore();

// 个性装扮：动态背景（视频 / 图片壁纸）+ 从壁纸吸取主色
const { hasDynamicBackground } = useDynamicBackground();

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

// 评分标签柔和底色
const securityColorSoft = computed(() => {
  const score = securityScore.value;
  if (score >= 75) return "rgba(34, 197, 94, 0.12)";
  if (score >= 50) return "rgba(251, 191, 36, 0.14)";
  return "rgba(248, 113, 113, 0.14)";
});

const securitySummary = computed(() => {
  const score = securityScore.value;
  if (score >= 100) return "您的账号安全措施完善，请继续保持";
  if (score >= 75) return "您的账号安全性良好，建议完善剩余安全设置";
  if (score >= 50) return "您的账号存在安全隐患，建议及时完善安全设置";
  return "您的账号存在严重安全隐患，请立即完善安全设置";
});

// 只保留未完成项
const securityTodoLabels = computed(() =>
  securityItems.value.filter((i) => !i.done).map((i) => i.label),
);

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
  &.has-dynamic-bg > :not(.dynamic-bg-layer) {
    position: relative;
    z-index: 1;
  }

  /* 侧边栏悬浮卡片要始终盖在内容之上，否则会被同层内容遮住 */
  &.has-dynamic-bg .qq-sidebar {
    z-index: 2;
  }

}

.safe-main {
  flex: 1;
  min-width: 0;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
}

/* 全屏铺开 + 大厂常用留白 */
.safe-shell {
  width: 100%;
  max-width: 1080px;
  min-width: 0;
  margin: 0 auto;
  padding: 40px 48px 80px;
}

/* ========== 顶部身份区 ========== */
.hero {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 24px;
}

.hero-avatar {
  width: 76px;
  height: 76px;
  border-radius: 50%;
  overflow: hidden;
  flex-shrink: 0;
  /* 极细的白色边框（2px），移除原来粗重的 box-shadow 描边 */
  border: 2px solid #ffffff;
  /* 保留轻微外发光以增强在深色背景下的立体感，但不再造成粗边 */
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.08),
    0 2px 8px rgba(0, 0, 0, 0.12);

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
}

/* 动态背景下的头像边框：更亮白，微光更明显，确保清晰可见 */
.account-safe-page.has-dynamic-bg .hero-avatar {
  border-color: var(--dt-text);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.2),
    0 2px 10px rgba(0, 0, 0, 0.3);
}

.hero-text {
  flex: 1;
  min-width: 0;
}

.hero-name {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.3px;
  color: var(--text-primary);
}

.hero-sub {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text-tertiary);
}

.hero-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 4px 12px 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  line-height: 1.6;
  white-space: nowrap;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid transparent;
  transition: all 0.18s;

  .chip-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #c9cdd4;
    flex-shrink: 0;
  }

  .chip-dot.neutral {
    background: #94a3b8;
  }

  &.ok {
    color: #16a34a;
    background: rgba(34, 197, 94, 0.1);

    .chip-dot {
      background: #22c55e;
    }
  }
}

.hero-edit {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  padding: 8px 16px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.18s;

  /* ✅ 图标调小：15px → 13px */
  .anticon {
    font-size: 13px;
  }

  &:hover {
    color: var(--color-brand);
    border-color: var(--color-brand);
    background: var(--color-brand-light, rgba(22, 119, 255, 0.04));
  }
}

/* ========== 卡片（大厂通用） ========== */
.card {
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: 8px 22px;
  margin-bottom: 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);

  &.card-danger {
    border-color: rgba(239, 68, 68, 0.22);
    background: rgba(239, 68, 68, 0.02);
  }
}

/* ========== 安全评分卡片 ========== */
.score-card {
  display: flex;
  align-items: center;
  gap: 22px;
  padding: 22px 26px;
  margin-bottom: 20px;
  background: var(--bg-primary);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
}

.score-ring {
  position: relative;
  width: 80px;
  height: 80px;
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
  font-size: 24px;
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
  gap: 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);

  em {
    padding: 3px 10px;
    border-radius: 6px;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
  }
}

.score-desc {
  margin: 6px 0 0;
  font-size: 12.5px;
  color: var(--text-tertiary);
}

/* 待完善提示（替代原来的 4 个胶囊） */
.score-todo {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  margin: 10px 0 0;
  font-size: 12.5px;
  color: var(--text-secondary);
}

.score-todo-label {
  padding: 2px 8px;
  border-radius: 5px;
  font-size: 11.5px;
  font-weight: 500;
  color: #d97706;
  background: rgba(251, 191, 36, 0.14);
}

.score-todo-items {
  color: var(--text-secondary);
}

.score-todo-link {
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-brand);
  font-size: 12.5px;
  font-weight: 500;
  cursor: pointer;

  &:hover {
    text-decoration: underline;
  }
}

/* ========== 分段导航（胶囊 Tab） ========== */
.seg {
  display: inline-flex;
  gap: 4px;
  padding: 4px;
  margin-bottom: 20px;
  border-radius: 12px;
  background: var(--bg-secondary);
}

.seg-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 8px 18px;
  white-space: nowrap;
  border: none;
  border-radius: 9px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;

  /* ✅ 图标调小：16px → 14px */
  .anticon {
    font-size: 14px;
  }

  &:hover {
    color: var(--text-primary);
  }

  &.active {
    color: var(--color-brand);
    background: var(--bg-primary);
    font-weight: 600;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  }
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

.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 0 10px;
}

.block-title {
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.2px;
  color: var(--text-primary);
}

.block-extra {
  font-size: 12.5px;
  color: var(--text-tertiary);

  &.ok {
    color: #16a34a;
    font-weight: 500;
  }
}

/* ========== 通用列表行 ========== */
.row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 0;

  & + .row {
    border-top: 1px solid var(--border-color);
  }
}

.row-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  border-radius: 10px;
  background: var(--bg-secondary);
  color: var(--text-secondary);

  /* ✅ 图标调小：18px → 16px */
  .anticon {
    font-size: 16px;
  }
}

.row-chevron {
  width: auto;
  height: auto;
  background: transparent;

  /* ✅ 右侧箭头也调小：16px → 13px */
  .anticon {
    font-size: 13px;
  }
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

  &.is-empty {
    color: var(--text-tertiary);
  }
}

/* 危险行：退出登录（无 hover 效果） */
.row-danger {
  cursor: pointer;

  .row-icon,
  .row-title {
    color: var(--error-color);
  }

  .row-icon {
    background: rgba(239, 68, 68, 0.1);
  }
}

/* ========== 设备行（专门优化） ========== */
.device-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 0;

  & + .device-row {
    border-top: 1px solid var(--border-color);
  }

  &.is-current {
    .device-name-text {
      color: #fff;
    }

    .device-icon {
      color: #fff;
      background: rgba(0, 0, 0, 0.32);
    }
  }
}

.device-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  border-radius: 12px;
  background: var(--bg-secondary);
  color: var(--text-secondary);

  /* ✅ 图标调小：20px → 17px */
  .anticon {
    font-size: 17px;
  }
}

.device-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.device-name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

/* 设备名：加粗 + 白色文字，长主机名不再糊成一团 */
.device-name-text {
  font-size: 14.5px;
  font-weight: 600;
  letter-spacing: 0.1px;
  color: #fff;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

/* 元信息：小字、浅灰、用「·」分隔 */
.device-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12.5px;
  color: var(--text-secondary);
  line-height: 1.5;

  &.is-sub {
    color: var(--text-tertiary);
  }
}

.meta-dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: currentColor;
  opacity: 0.45;
  flex-shrink: 0;
}

.device-action {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  min-width: 92px;
}

/* 当前设备：仅文字，无边框、无背景、无圆点 */
.current-text {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 13px;
  font-weight: 500;
  color: #fff;
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
  flex-shrink: 0;
}

/* 设备被踢后又回来：说明后端没让它真正下线 */
.offline-hint {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 4px 0 12px;
  padding: 12px 14px;
  border-radius: 12px;
  font-size: 12.5px;
  line-height: 1.65;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);

  /* ✅ 提示图标也调小：16px → 14px */
  .anticon {
    font-size: 14px;
    flex-shrink: 0;
    margin-top: 2px;
    color: var(--error-color);
  }
}

/* ========== 操作按钮 ========== */
.act {
  padding: 6px 15px;
  border: 1px solid var(--border-color);
  border-radius: 10px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.16s;

  &:hover {
    color: var(--color-brand);
    border-color: var(--color-brand);
    background: var(--color-brand-light, rgba(22, 119, 255, 0.06));
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
    background: transparent;

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

  /* ✅ 空状态图标调小：34px → 28px */
  .anticon {
    font-size: 28px;
    opacity: 0.55;
  }

  p {
    margin: 0;
    font-size: 13px;
  }
}

/* ========== 电池 ========== */
.batt {
  padding: 6px 0 10px;
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
  padding: 12px 0;
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
  .score-todo,
  .device-name-text,
  .device-meta,
  .current-text {
    text-shadow: var(--dt-text-shadow);
  }

  // 卡片 / 容器：改用半透明深底，保证在壁纸上看得清
  .card,
  .score-card,
  .seg,
  .chip,
  .batt-tag,
  .row-icon,
  .device-icon,
  .score-title em {
    background: rgba(0, 0, 0, 0.32);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.92);
  }

  .card.card-danger {
    background: rgba(239, 68, 68, 0.14);
    border-color: rgba(248, 113, 113, 0.4);
  }

  .seg-btn.active {
    background: rgba(255, 255, 255, 0.16);
    color: #fff;
    box-shadow: none;
  }

  .score-todo-label {
    color: #fcd34d;
    background: rgba(251, 191, 36, 0.2);
  }

  /* 动态背景下：设备名 + 当前设备文字全部白字 */
  .device-name-text {
    color: #fff;
  }

  .device-row.is-current {
    .device-name-text {
      color: #fff;
    }

    .device-icon {
      color: #fff;
      background: rgba(0, 0, 0, 0.32);
    }
  }

  .current-text {
    color: #fff;
  }

  .session-badge,
  .offline-hint {
    background: rgba(0, 0, 0, 0.32);
    border-color: rgba(255, 255, 255, 0.2);
    color: rgba(255, 255, 255, 0.92);
  }

  .chip.ok,
  .row-value.ok,
  .kv-value.ok,
  .block-extra.ok {
    color: #86efac;
  }

  .ring-track {
    stroke: rgba(255, 255, 255, 0.24);
  }

  .batt-bar {
    background: rgba(0, 0, 0, 0.3);
  }

  .act,
  .hero-edit {
    background: rgba(0, 0, 0, 0.28);
    border-color: rgba(255, 255, 255, 0.28);
    color: rgba(255, 255, 255, 0.92);

    &:hover {
      background: rgba(0, 0, 0, 0.42);
      border-color: rgba(255, 255, 255, 0.55);
      color: #fff;
    }
  }

  .act.primary {
    background: var(--color-brand);
    color: #fff;

    &:hover {
      background: var(--color-brand-hover);
    }
  }

  .act.danger {
    background: rgba(239, 68, 68, 0.16);
    border-color: rgba(248, 113, 113, 0.5);
    color: #fca5a5;

    &:hover {
      background: rgba(239, 68, 68, 0.28);
      color: #fecaca;
    }
  }

  .row + .row,
  .device-row + .device-row {
    border-top-color: rgba(255, 255, 255, 0.14);
  }

  .kv {
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.14);
  }
}

/* ========== 响应式 ========== */
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
    display: flex;
    width: 100%;
  }

  .seg-btn {
    min-width: 0;
    flex: 1;
    padding: 8px 8px;
    font-size: 13px;
  }

  .seg-btn .anticon {
    display: none;
  }

  .row {
    flex-wrap: wrap;
  }

  .row-side {
    width: 100%;
    justify-content: flex-end;
    padding-left: 50px;
  }

  .device-row {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .device-action {
    width: 100%;
    justify-content: flex-end;
    padding-left: 54px;
  }

  .batt-num {
    font-size: 36px;
  }
}
</style>
