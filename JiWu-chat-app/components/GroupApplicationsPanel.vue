<!-- 群通知：右栏内联面板（替代原「群聊申请记录 / 群申请管理」两个弹窗） -->
<template>
  <div class="notice-panel" :class="{ 'has-dynamic-bg': isDynamic }" :style="panelStyle">
    <div class="panel-header">
      <div class="header-text">
        <h3 class="panel-title">群通知</h3>
        <p class="panel-subtitle">查看群申请与入群审核</p>
      </div>
      <button class="back-btn" type="button" @click="emit('close')">返回</button>
    </div>

    <div class="panel-tabs">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'mine' }"
        @click="activeTab = 'mine'"
      >
        我申请的群聊
      </button>
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'manage' }"
        @click="activeTab = 'manage'"
      >
        群申请管理
      </button>
    </div>

    <div class="panel-body">
      <!-- 我申请的群聊 -->
      <template v-if="activeTab === 'mine'">
        <div v-if="loading" class="state">
          <span class="spinner"></span>
          <p>加载中...</p>
        </div>
        <div v-else-if="myApplications.length === 0" class="state empty">
          <p class="empty-title">还没有申请记录</p>
          <p class="empty-hint">你还没申请加入任何群聊</p>
        </div>
        <div v-else class="list">
          <div v-for="app in myApplications" :key="app.id" class="card">
            <img :src="app.avatar" :alt="app.groupName" class="avatar" />
            <div class="info">
              <div class="name-row">
                <span class="name">{{ app.groupName }}</span>
                <span class="status-badge" :class="`status-${app.status}`">
                  {{ statusText(app.status) }}
                </span>
              </div>
              <div class="meta">群号：{{ app.groupNumber }}</div>
              <div class="meta">申请时间：{{ app.createdAt }}</div>
              <div v-if="app.message" class="remark">
                <span class="remark-label">申请备注：</span>
                <span class="remark-text">{{ app.message }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 群申请管理 -->
      <template v-else>
        <div v-if="manageableGroups.length === 0" class="state empty">
          <p class="empty-title">暂无需要管理的群聊</p>
          <p class="empty-hint">只有群主或管理员可以审核入群申请</p>
        </div>
        <template v-else>
          <div class="group-selector">
            <span class="selector-label">选择群聊</span>
            <select v-model="selectedGroupId" class="selector">
              <option
                v-for="g in manageableGroups"
                :key="g.originalId"
                :value="g.originalId"
              >
                {{ g.name }}
              </option>
            </select>
          </div>

          <div v-if="loading" class="state">
            <span class="spinner"></span>
            <p>加载中...</p>
          </div>
          <div v-else-if="manageApplications.length === 0" class="state empty">
            <p class="empty-title">暂无申请记录</p>
            <p class="empty-hint">还没人申请加入这个群</p>
          </div>
          <div v-else class="list">
            <div v-for="app in manageApplications" :key="app.id" class="card">
              <img :src="app.avatar" :alt="app.username" class="avatar" />
              <div class="info">
                <div class="name-row">
                  <span class="name">{{ app.username }}</span>
                  <span class="time">{{ app.createdAt }}</span>
                </div>
                <div v-if="app.message" class="remark">
                  <span class="remark-label">申请备注：</span>
                  <span class="remark-text">{{ app.message }}</span>
                </div>
                <div v-if="app.status === 'pending'" class="actions">
                  <button class="action accept" @click="handleApprove(Number(app.id))">
                    同意
                  </button>
                  <button class="action reject" @click="handleReject(Number(app.id))">
                    拒绝
                  </button>
                </div>
                <span v-else class="status-badge" :class="`status-${app.status}`">
                  {{ statusText(app.status) }}
                </span>
              </div>
            </div>
          </div>
        </template>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import request from "../untils/request";
import { message } from "ant-design-vue";
import { useSiderColor } from "../stores/siderColor";

interface ManageableGroup {
  originalId: string;
  name: string;
  role?: string;
}

const props = defineProps<{
  groups?: Array<ManageableGroup>;
  currentGroupId?: string;
}>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "refresh"): void;
}>();

// 动态主题（个性装扮壁纸）适配：文字转白、卡片半透明毛玻璃、主色取自壁纸
const siderColorStore = useSiderColor();
const isDynamic = computed(() => siderColorStore.hasDynamicBackground);
const panelStyle = computed(() => {
  if (isDynamic.value) {
    return {
      "--notice-accent": siderColorStore.dynamicAccent,
      "--notice-text": "#ffffff",
      "--notice-text-2": "rgba(255, 255, 255, 0.88)",
      "--notice-text-3": "rgba(255, 255, 255, 0.62)",
      "--notice-card-bg": "rgba(0, 0, 0, 0.34)",
      "--notice-card-border": "rgba(255, 255, 255, 0.16)",
      "--notice-soft-bg": "rgba(255, 255, 255, 0.14)",
      "--notice-soft-bg-2": "rgba(255, 255, 255, 0.24)",
      "--notice-danger": "#ff8f8f",
    };
  }
  return {
    "--notice-accent": siderColorStore.currentColorPalette.color,
  };
});

const activeTab = ref<"mine" | "manage">("mine");
const myApplications = ref<any[]>([]);
const manageApplications = ref<any[]>([]);
const loading = ref(false);
const selectedGroupId = ref<string>("");

const manageableGroups = computed(() =>
  (props.groups || []).filter((g) => g.role === "owner" || g.role === "admin"),
);

const statusText = (status: string) => {
  switch (status) {
    case "pending":
      return "待审核";
    case "approved":
    case "accepted":
      return "已通过";
    case "rejected":
      return "已拒绝";
    case "blocked":
      return "已屏蔽";
    default:
      return status;
  }
};

const loadMyApplications = async () => {
  loading.value = true;
  try {
    const res = await request.get("/group/my-applications");
    myApplications.value = res.data.applications || [];
  } catch (error: any) {
    message.error(error.response?.data?.data?.message || "加载申请记录失败");
  } finally {
    loading.value = false;
  }
};

const loadManageApplications = async () => {
  if (!selectedGroupId.value) {
    manageApplications.value = [];
    return;
  }
  loading.value = true;
  try {
    const res = await request.get(`/group/${selectedGroupId.value}/applications`);
    manageApplications.value = res.data.applications || [];
  } catch (error: any) {
    message.error(error.response?.data?.data?.message || "加载申请记录失败");
  } finally {
    loading.value = false;
  }
};

const handleApprove = async (applicationId: number) => {
  try {
    await request.put(`/group/applications/${applicationId}`, { status: "approved" });
    message.success("已同意加入");
    await loadManageApplications();
    emit("refresh");
  } catch (error: any) {
    message.error(error.response?.data?.data?.message || "操作失败");
  }
};

const handleReject = async (applicationId: number) => {
  try {
    await request.put(`/group/applications/${applicationId}`, { status: "rejected" });
    message.success("已拒绝申请");
    await loadManageApplications();
    emit("refresh");
  } catch (error: any) {
    message.error(error.response?.data?.data?.message || "操作失败");
  }
};

// 可管理群聊变化时，确定默认选中的群（优先当前选中群，否则取第一个）
watch(
  manageableGroups,
  (list) => {
    if (!list.length) {
      selectedGroupId.value = "";
      manageApplications.value = [];
      return;
    }
    const prefer =
      props.currentGroupId && list.some((g) => g.originalId === props.currentGroupId)
        ? props.currentGroupId
        : list[0].originalId;
    if (selectedGroupId.value !== prefer) {
      selectedGroupId.value = prefer;
    }
  },
  { immediate: true },
);

watch(
  activeTab,
  () => {
    if (activeTab.value === "mine") loadMyApplications();
    else if (selectedGroupId.value) loadManageApplications();
  },
  { immediate: true },
);

watch(selectedGroupId, (val) => {
  if (activeTab.value === "manage" && val) loadManageApplications();
});
</script>

<style scoped lang="scss">
.notice-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;

  // 动态主题（个性装扮壁纸）适配：文字投影 + 卡片毛玻璃
  &.has-dynamic-bg {
    .panel-title,
    .panel-subtitle,
    .name,
    .time,
    .meta,
    .remark,
    .empty-title,
    .empty-hint,
    .selector-label {
      text-shadow:
        0 1px 3px rgba(0, 0, 0, 0.7),
        0 0 8px rgba(0, 0, 0, 0.45);
    }

    .card {
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
    }

    .back-btn,
    .tab-btn,
    .selector {
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
    }
  }
}

.panel-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px solid var(--notice-card-border, var(--border-color, #f0f0f0));

  .panel-title {
    margin: 0 0 2px;
    font-size: 18px;
    font-weight: 600;
    color: var(--notice-text, var(--text-primary, #1f1f1f));
  }

  .panel-subtitle {
    margin: 0;
    font-size: 12px;
    color: var(--notice-text-3, var(--text-tertiary, #999));
  }

  .back-btn {
    flex-shrink: 0;
    padding: 4px 12px;
    font-size: 13px;
    color: var(--notice-text-2, var(--text-secondary, #666));
    background: transparent;
    border: 1px solid var(--notice-card-border, var(--border-color, #e5e5e5));
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      color: var(--notice-accent, var(--purple-color, #8b5cf6));
      border-color: var(--notice-accent, var(--purple-color, #8b5cf6));
    }
  }
}

.panel-tabs {
  display: flex;
  gap: 8px;
  padding: 12px 0;
  flex-shrink: 0;

  .tab-btn {
    padding: 6px 16px;
    font-size: 13px;
    color: var(--notice-text-2, var(--text-secondary, #666));
    background: var(--notice-soft-bg, var(--bg-tertiary, #f5f5f5));
    border: none;
    border-radius: 20px;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      background: var(--notice-soft-bg-2, var(--bg-hover, #e5e5e5));
    }

    &.active {
      background: var(--notice-accent, var(--purple-color, #8b5cf6));
      color: #fff;
    }
  }
}

.panel-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;

  .group-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;

    .selector-label {
      font-size: 13px;
      color: var(--notice-text-2, var(--text-secondary, #666));
      flex-shrink: 0;
    }

    .selector {
      flex: 1;
      max-width: 260px;
      padding: 6px 10px;
      font-size: 13px;
      color: var(--notice-text, var(--text-primary, #1f1f1f));
      background: var(--notice-card-bg, var(--card-bg, #fff));
      border: 1px solid var(--notice-card-border, var(--border-color, #e5e5e5));
      border-radius: 4px;
      outline: none;

      &:focus {
        border-color: var(--notice-accent, var(--purple-color, #8b5cf6));
      }
    }
  }

  .state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 48px 20px;
    gap: 8px;
    color: var(--notice-text-3, var(--text-tertiary, #999));
    font-size: 13px;

    .spinner {
      width: 24px;
      height: 24px;
      border: 2px solid var(--notice-card-border, var(--border-color, #f0f0f0));
      border-top-color: var(--notice-accent, var(--purple-color, #8b5cf6));
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    p {
      margin: 0;
    }

    .empty-title {
      font-size: 14px;
      color: var(--notice-text-2, var(--text-secondary, #666));
    }

    .empty-hint {
      font-size: 12px;
    }
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding-bottom: 12px;
  }

  .card {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 14px;
    background: var(--notice-card-bg, var(--card-bg, #fafafa));
    border: 1px solid var(--notice-card-border, var(--border-color, #f0f0f0));
    border-radius: 10px;
  }

  .avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    background: #e8e8e8;
  }

  .info {
    flex: 1;
    min-width: 0;

    .name-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;

      .name {
        font-size: 14px;
        font-weight: 600;
        color: var(--notice-text, var(--text-primary, #1f1f1f));
      }

      .time {
        font-size: 11px;
        color: var(--notice-text-3, var(--text-tertiary, #999));
        flex-shrink: 0;
      }
    }

    .meta {
      font-size: 12px;
      color: var(--notice-text-2, var(--text-secondary, #666));
      margin-bottom: 2px;
    }

    .remark {
      font-size: 12px;
      color: var(--notice-text-2, var(--text-secondary, #555));
      background: var(--notice-soft-bg, var(--bg-tertiary, #f0f0f0));
      padding: 6px 10px;
      border-radius: 4px;
      margin-top: 4px;

      .remark-label {
        font-weight: 500;
        color: var(--notice-text, var(--text-primary, #333));
      }
    }
  }

  .actions {
    display: flex;
    gap: 8px;
    margin-top: 6px;

    .action {
      padding: 5px 14px;
      font-size: 13px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      transition: all 0.2s;

      &.accept {
        background: var(--notice-accent, var(--purple-color, #8b5cf6));
        color: #fff;

        &:hover {
          opacity: 0.85;
        }
      }

      &.reject {
        background: var(--notice-soft-bg, var(--bg-tertiary, #f5f5f5));
        color: var(--notice-text-2, var(--text-secondary, #666));

        &:hover {
          background: var(--notice-soft-bg-2, var(--bg-hover, #e8e8e8));
        }
      }
    }
  }

  .status-badge {
    flex-shrink: 0;
    padding: 2px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 500;

    &.status-pending {
      background: #fff7e6;
      color: #d46b00;
    }

    &.status-approved,
    &.status-accepted {
      background: #f6ffed;
      color: #389e0d;
    }

    &.status-rejected {
      background: #fff2f0;
      color: #cf1322;
    }

    &.status-blocked {
      background: #f5f5f5;
      color: #8c8c8c;
    }
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
