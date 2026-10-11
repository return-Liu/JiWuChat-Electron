<!-- 好友通知：右栏内联面板（替代原「收到的好友申请 / 我发起的申请」两个弹窗） -->
<template>
  <div class="notice-panel" :class="{ 'has-dynamic-bg': isDynamic }" :style="panelStyle">
    <div class="panel-header">
      <div class="header-text">
        <h3 class="panel-title">好友通知</h3>
        <p class="panel-subtitle">处理好友申请，拓展你的社交圈</p>
      </div>
      <button class="back-btn" type="button" @click="emit('close')">返回</button>
    </div>

    <div class="panel-tabs">
      <button
        class="tab-btn"
        :class="{ active: activeTab === 'received' }"
        @click="activeTab = 'received'"
      >
        收到的好友申请
      </button>
      <button class="tab-btn" :class="{ active: activeTab === 'sent' }" @click="activeTab = 'sent'">
        我发起的申请
      </button>
    </div>

    <div class="panel-body">
      <!-- 收到的好友申请 -->
      <template v-if="activeTab === 'received'">
        <div v-if="loading" class="state">
          <span class="spinner"></span>
          <p>加载中...</p>
        </div>
        <div v-else-if="receivedRequests.length === 0" class="state empty">
          <p class="empty-title">暂无好友申请</p>
          <p class="empty-hint">有新的好友申请会第一时间显示在这里</p>
        </div>
        <div v-else class="list">
          <div v-for="req in receivedRequests" :key="req.id" class="card">
            <img :src="req.user.avatar || defaultAvatar" :alt="req.user.nickname" class="avatar" />
            <div class="info">
              <div class="name-row">
                <span class="name">{{ req.user.nickname || req.user.username }}</span>
                <span class="time">{{ formatTime(req.createdAt) }}</span>
              </div>
              <p class="bio">{{ req.user.bio || "暂无个人介绍" }}</p>
              <div v-if="req.remark" class="remark">
                <span class="remark-label">附言：</span>
                <span class="remark-text">{{ req.remark }}</span>
              </div>

              <!-- 操作按钮区：右对齐、独立成行 -->
              <div class="actions">
                <button
                  class="action reject"
                  :disabled="processingIds.includes(req.id)"
                  @click="handleRequest(req.id, 'reject')"
                >
                  {{ processingIds.includes(req.id) ? "处理中" : "拒绝" }}
                </button>
                <button
                  class="action accept"
                  :disabled="processingIds.includes(req.id)"
                  @click="handleRequest(req.id, 'accept')"
                >
                  {{ processingIds.includes(req.id) ? "处理中" : "接受" }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- 我发起的申请 -->
      <template v-else>
        <div v-if="loading" class="state">
          <span class="spinner"></span>
          <p>加载中...</p>
        </div>
        <div v-else-if="sentRequests.length === 0" class="state empty">
          <p class="empty-title">暂无申请记录</p>
          <p class="empty-hint">你还未发起任何好友申请</p>
        </div>
        <div v-else class="list">
          <div v-for="req in sentRequests" :key="req.id" class="card">
            <img :src="req.user.avatar || defaultAvatar" :alt="req.user.nickname" class="avatar" />
            <div class="info">
              <div class="name-row">
                <span class="name">{{ req.user.nickname || req.user.username }}</span>
                <span class="time">{{ formatTime(req.createdAt) }}</span>
              </div>
              <p class="bio">{{ req.user.bio || "暂无个人介绍" }}</p>

              <!-- 底部：左侧状态徽章，右侧操作按钮 -->
              <div class="card-footer">
                <span class="status-badge" :class="`status-${req.status}`">
                  {{ statusText[req.status] || req.status }}
                </span>
                <div class="actions">
                  <button
                    v-if="req.status === 'pending'"
                    class="action danger"
                    :disabled="processingIds.includes(req.id)"
                    @click="handleCancel(req.id)"
                  >
                    {{ processingIds.includes(req.id) ? "处理中" : "撤回" }}
                  </button>
                  <button
                    v-else
                    class="action danger"
                    :disabled="processingIds.includes(req.id)"
                    @click="handleDelete(req.id)"
                  >
                    {{ processingIds.includes(req.id) ? "处理中" : "删除" }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { message, Modal } from "ant-design-vue";
import {
  getFriendRequests,
  handleFriendRequest,
  cancelFriendRequest,
  deleteFriendRequest,
} from "../untils/friendManager";
import type { FriendRequest } from "../types/untilsTypes";
import { useSiderColor } from "../stores/siderColor";

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

const activeTab = ref<"received" | "sent">("received");
const receivedRequests = ref<FriendRequest[]>([]);
const sentRequests = ref<FriendRequest[]>([]);
const loading = ref(false);
const processingIds = ref<number[]>([]);
const defaultAvatar = "https://via.placeholder.com/48x48?text=User";

const statusText: Record<string, string> = {
  pending: "等待处理",
  accepted: "已通过",
  rejected: "已拒绝",
  blocked: "已屏蔽",
};

const formatTime = (time: string) => time || "";

const loadAll = async () => {
  loading.value = true;
  try {
    const [received, sent] = await Promise.all([
      getFriendRequests({ status: "pending" }).catch(() => [] as FriendRequest[]),
      getFriendRequests({ all: true }).catch(() => [] as FriendRequest[]),
    ]);
    receivedRequests.value = received.filter((r) => r.requestType === "received");
    sentRequests.value = sent.filter((r) => r.requestType === "sent");
  } catch {
    message.error("加载好友申请失败");
  } finally {
    loading.value = false;
  }
};

const handleRequest = async (id: number, action: "accept" | "reject") => {
  if (processingIds.value.includes(id)) return;
  processingIds.value.push(id);
  try {
    await handleFriendRequest(id, action);
    receivedRequests.value = receivedRequests.value.filter((r: FriendRequest) => r.id !== id);
    emit("refresh");
  } catch {
    // 错误提示由 friendManager 内部处理
  } finally {
    processingIds.value = processingIds.value.filter((i) => i !== id);
  }
};

const handleCancel = (id: number) => {
  Modal.confirm({
    title: "确认撤回",
    content: "确定要撤回这条好友申请吗？",
    okText: "确认",
    cancelText: "取消",
    onOk: async () => {
      processingIds.value.push(id);
      try {
        await cancelFriendRequest(id);
        sentRequests.value = sentRequests.value.filter((r) => r.id !== id);
        emit("refresh");
      } catch {
        // 错误提示由 friendManager 内部处理
      } finally {
        processingIds.value = processingIds.value.filter((i) => i !== id);
      }
    },
  });
};

const handleDelete = (id: number) => {
  Modal.confirm({
    title: "确认删除",
    content: "确定要删除这条记录吗？",
    okText: "确认",
    cancelText: "取消",
    onOk: async () => {
      processingIds.value.push(id);
      try {
        await deleteFriendRequest(id);
        sentRequests.value = sentRequests.value.filter((r) => r.id !== id);
        emit("refresh");
      } catch {
        // 错误提示由 friendManager 内部处理
      } finally {
        processingIds.value = processingIds.value.filter((i) => i !== id);
      }
    },
  });
};

onMounted(loadAll);
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
    .bio,
    .remark,
    .time-row,
    .empty-title,
    .empty-hint {
      text-shadow: var(--dt-text-shadow);
    }

    .card {
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.25);
    }

    .back-btn,
    .tab-btn {
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
  border-bottom: 1px solid var(--notice-card-border, var(--border-color, var(--border-color)));

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
    border: 1px solid var(--notice-card-border, var(--border-color, var(--border-color)));
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
    border-radius: 6px; /* 小圆角 */
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
      border: 2px solid var(--notice-card-border, var(--border-color, var(--border-color)));
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
    border: 1px solid var(--notice-card-border, var(--border-color, var(--border-color)));
    border-radius: 10px;
  }

  .avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
    background: var(--bg-secondary);
  }

  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;

    .name-row {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 4px;

      .name {
        font-size: 14px;
        font-weight: 600;
        color: var(--notice-text, var(--text-primary, #1f1f1f));
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .time {
        font-size: 11px;
        color: var(--notice-text-3, var(--text-tertiary, #999));
        flex-shrink: 0;
        padding: 2px 8px;
        background: var(--notice-tag-bg, rgba(0, 0, 0, 0.05));
        border-radius: 10px;
        white-space: nowrap;
      }
    }

    .bio {
      margin: 0 0 6px;
      font-size: 12px;
      color: var(--notice-text-2, var(--text-secondary, #666));
      line-height: 1.4;
    }

    .remark {
      font-size: 12px;
      color: var(--notice-text-2, var(--text-secondary, #555));
      background: var(--notice-soft-bg, var(--bg-tertiary, #f0f0f0));
      padding: 6px 10px;
      border-radius: 4px;

      .remark-label {
        font-weight: 500;
        color: var(--notice-text, var(--text-primary, #333));
      }
    }

    .time-row {
      font-size: 11px;
      color: var(--notice-text-3, var(--text-tertiary, #999));
    }
  }

  /* 底部行：左侧状态徽章 + 右侧操作按钮 */
  .card-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px dashed var(--notice-card-border, var(--border-color, var(--border-color)));

    /* 操作按钮区：右对齐 */
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;

      .action {
        min-width: 72px;
        padding: 6px 18px;
        font-size: 13px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.18s ease;
        line-height: 1.4;

        &:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        /* 接受：蓝色实心 */
        &.accept {
          background: #1677ff;
          color: #fff;
          border: 1px solid transparent;
          box-shadow: 0 2px 6px rgba(22, 119, 255, 0.25);

          &:hover:not(:disabled) {
            background: #4096ff;
            transform: translateY(-1px);
            box-shadow: 0 4px 10px rgba(22, 119, 255, 0.3);
          }

          &:active:not(:disabled) {
            background: #0958d9;
            transform: translateY(0);
            box-shadow: 0 1px 3px rgba(22, 119, 255, 0.2);
          }
        }

        /* 拒绝：描边弱化 */
        &.reject {
          background: transparent;
          color: var(--notice-text-2, var(--text-secondary, #666));
          border: 1px solid var(--notice-card-border, var(--border-color, var(--border-color)));

          &:hover:not(:disabled) {
            color: var(--notice-danger, #cf1322);
            border-color: var(--notice-danger, #cf1322);
            background: rgba(207, 19, 34, 0.06);
          }
        }

        /* 危险操作：撤回 / 删除 */
        &.danger {
          background: transparent;
          color: var(--notice-danger, var(--danger-color, #ff4d4f));
          border: 1px solid var(--notice-danger, var(--danger-color, #ff4d4f));

          &:hover:not(:disabled) {
            background: var(--notice-danger, var(--danger-color, #ff4d4f));
            color: #fff;
          }
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
      background: var(--warning-bg);
      color: #d46b00;
    }

    &.status-accepted {
      background: #f6ffed;
      color: #389e0d;
    }

    &.status-rejected {
      background: var(--error-bg);
      color: #cf1322;
    }

    &.status-blocked {
      background: var(--bg-tertiary);
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
