<template>
  <!-- 右键菜单统一交给外层 MessageDisplay 的 .message-content 冒泡处理，
       不再 stopPropagation：这样群主 / 管理员权限（contacts、activeContactId）
       由 RightChatArea 的菜单正确计算，也不会出现两套菜单实现。 -->
  <div
    class="group-system-message"
    :class="{ 'has-dynamic-bg': siderColorStore.hasDynamicBackground }"
  >
    <div
      class="msg-card"
      :class="{
        'expired-card': isExpired,
        'accepted-card': messageType === 'group_invite_accepted',
        'rejected-card': messageType === 'group_invite_rejected',
        'pending-card': messageType === 'group_invite_pending',
        'notification-card': messageType === 'group_notification',
      }"
      :data-message-id="message.id"
      @click="handleCardClick"
    >
      <div class="msg-card-body">
        <div class="msg-info">
          <div class="msg-title">{{ title }}</div>
          <div class="msg-subtitle">{{ subtitle }}</div>
        </div>
        <div class="card-avatar">
          <img :src="avatarUrl" alt="" />
        </div>
      </div>

      <div class="card-divider" />

      <div class="card-footer">
        <div class="status-wrapper">
          <span class="status-text">{{ statusText }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { message as antMessage } from "ant-design-vue";
import type { ChatMessage } from "../types/chatTypes";
import { useSiderColor } from "../stores/siderColor";

import {
  isInviteExpired,
  parseSystemMessageContent,
  getSystemMessageTitle,
  getSystemMessageSubtitle,
  getSystemMessageStatusText,
} from "../untils/systemMessageUtils";

const siderColorStore = useSiderColor();

interface Props {
  message: ChatMessage;
  currentUserId: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  openDetail: [message: ChatMessage];
}>();

// ✅ 安全解析消息内容
const messageData = computed(() => {
  try {
    return parseSystemMessageContent(props.message.content);
  } catch (e) {
    console.warn("解析系统消息内容失败:", e);
    return {};
  }
});

// ✅ 安全获取头像
const avatarUrl = computed(() => {
  return messageData.value?.groupAvatar || "/default-group-avatar.png";
});

// ✅ 安全获取 messageType（兼容空值）
const messageType = computed(() => {
  return props.message?.messageType || "";
});

// ✅ 安全判断是否过期
const isExpired = computed(() => {
  // 只有 pending 状态才检查过期
  if (messageType.value !== "group_invite_pending") return false;
  return isInviteExpired(messageData.value);
});

// ✅ 标题（带默认值）
const title = computed(() => {
  if (!messageType.value) return "系统消息";
  return getSystemMessageTitle(messageType.value);
});

// ✅ 副标题（带默认值）
const subtitle = computed(() => {
  if (!messageType.value) {
    return props.message.content || "系统通知";
  }
  return getSystemMessageSubtitle(messageType.value, messageData.value);
});

// ✅ 状态文本（带默认值）
const statusText = computed(() => {
  if (!messageType.value) return "系统通知";
  return getSystemMessageStatusText(messageType.value);
});

function handleCardClick() {
  const systemTypes = [
    "group_invite_pending",
    "group_invite_accepted",
    "group_invite_rejected",
    "group_notification",
  ];

  // ✅ 检查 messageType 是否有效
  if (!messageType.value || !systemTypes.includes(messageType.value)) {
    return;
  }

  if (messageType.value === "group_invite_pending" && isExpired.value) {
    antMessage.warning("该入群邀请已过期，无法查看详情");
    return;
  }

  emit("openDetail", props.message);
}
</script>

<style scoped>
.group-system-message {
  margin: 6px 0;
}

.msg-card {
  width: 230px;
  background: var(--card-bg);
  border-radius: 12px;
  border: 1px solid var(--border-color);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.25s ease;
}

/* 个性装扮（动态背景）时，群聊卡片毛玻璃半透明深底（与消息气泡、通知面板一致） */
.group-system-message.has-dynamic-bg .msg-card {
  background: rgba(0, 0, 0, 0.34);
  border-color: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.group-system-message.has-dynamic-bg .msg-title {
  color: var(--dt-text);
  text-shadow: var(--dt-text-shadow);
}
.group-system-message.has-dynamic-bg .msg-subtitle,
.group-system-message.has-dynamic-bg .status-text {
  color: rgba(255, 255, 255, 0.85);
  text-shadow: var(--dt-text-shadow);
}
.group-system-message.has-dynamic-bg .card-divider {
  background: rgba(255, 255, 255, 0.25);
}
.group-system-message.has-dynamic-bg .card-avatar {
  background: rgba(255, 255, 255, 0.15);
}

.msg-card.expired-card {
  opacity: 0.6;
  cursor: default;
}

.msg-card.expired-card:hover {
  transform: none;
  box-shadow: none;
}

.msg-card-body {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 10px 12px;
  min-height: 56px;
}

.card-avatar {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bg-tertiary);
}

.card-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.msg-info {
  flex: 1;
  min-width: 0;
  padding-right: 8px;
}

.msg-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  line-height: 1.3;
}

.msg-subtitle {
  font-size: 11px;
  color: #8e8e93;
  margin-top: 2px;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-divider {
  height: 1px;
  background: var(--bg-tertiary);
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 12px;
}

.status-text {
  color: #8e8e93;
  font-size: 10px;
}
</style>
