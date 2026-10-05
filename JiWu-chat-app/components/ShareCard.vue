<template>
  <div class="share-card-wrap" :class="{ 'has-dynamic-bg': siderColorStore.hasDynamicBackground }">
    <!-- 名片卡片：与群邀请卡片（SystemMessageCard）一致的视觉 -->
    <div class="msg-card" @click="openDetail">
      <div class="msg-card-body">
        <div class="msg-info">
          <div class="msg-title">{{ title }}</div>
          <div class="msg-subtitle">{{ subtitle }}</div>
        </div>
        <div class="card-avatar">
          <img :src="avatar" alt="" />
        </div>
      </div>
      <div class="card-divider" />
      <div class="card-footer">
        <span class="status-text">{{ statusText }}</span>
      </div>
    </div>

    <Teleport to="body">
      <div v-if="detailVisible" class="share-detail-overlay" @click.self="detailVisible = false">
        <div class="share-detail-card">
          <div class="detail-header">
            <h3 class="detail-title">{{ isUser ? "好友信息" : "群聊信息" }}</h3>
            <button class="detail-close" type="button" @click="detailVisible = false">✕</button>
          </div>
          <div class="detail-body">
            <img :src="avatar" class="detail-avatar" alt="" />
            <h4 class="detail-name">{{ name }}</h4>
            <p class="detail-desc">{{ desc }}</p>
            <div class="detail-id">
              <span class="detail-id-label">{{ isUser ? "UID" : "群号" }}</span>
              <span class="detail-id-value">{{ idValue }}</span>
            </div>
            <button class="detail-action" type="button" @click="copyId">
              复制{{ isUser ? "UID" : "群号" }}
            </button>
            <p class="detail-tip">
              {{
                isUser ? "在客户端内搜索该 UID 即可添加好友" : "在客户端内搜索该群号即可加入群聊"
              }}
            </p>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { message } from "ant-design-vue";
import type { ChatMessage } from "../types/chatTypes";
import { useSiderColor } from "../stores/siderColor";

interface Props {
  message: ChatMessage;
}

const props = defineProps<Props>();

const siderColorStore = useSiderColor();
const detailVisible = ref(false);

/** 解析名片消息内容 */
const data = computed(() => {
  try {
    return typeof props.message.content === "string"
      ? JSON.parse(props.message.content)
      : props.message.content || {};
  } catch {
    return {};
  }
});

const isUser = computed(() => props.message.messageType === "share_user_card");

const avatar = computed(() =>
  isUser.value ? data.value.targetUser?.avatar || "" : data.value.targetGroup?.avatar || "",
);

const name = computed(() =>
  isUser.value
    ? data.value.targetUser?.nickname || data.value.targetUser?.username || "未知用户"
    : data.value.targetGroup?.name || "未知群聊",
);

const idValue = computed(() =>
  isUser.value ? data.value.targetUser?.uid || "" : data.value.targetGroup?.groupNumber || "",
);

const title = computed(() => (isUser.value ? "好友名片" : "群名片"));

const subtitle = computed(() =>
  isUser.value
    ? `用户：${data.value.targetUser?.nickname || data.value.targetUser?.username || "未知"}`
    : `群聊"${data.value.targetGroup?.name || "未知"}"，群号：${
        data.value.targetGroup?.groupNumber || "无"
      }`,
);

const statusText = computed(() => (isUser.value ? "查看好友" : "查看群聊"));

const desc = computed(() =>
  isUser.value
    ? data.value.targetUser?.bio || "这个人很懒，什么都没留下"
    : data.value.targetGroup?.rule || "暂无群公告",
);

const openDetail = () => {
  detailVisible.value = true;
};

const copyId = async () => {
  try {
    await navigator.clipboard.writeText(idValue.value);
    message.success("已复制到剪贴板");
  } catch {
    message.error("复制失败");
  }
};
</script>

<style scoped>
.share-card-wrap {
  margin: 2px 0;
}

/* 名片卡片：复用群邀请卡片（SystemMessageCard）视觉 */
.msg-card {
  width: 230px;
  background: #fff;
  border-radius: 12px;
  border: 1px solid #e5e5e5;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.25s ease;
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
  background: #f5f5f5;
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
  color: #1a1a1a;
  line-height: 1.3;
}

.msg-subtitle {
  font-size: 11px;
  color: #8e8e93;
  margin-top: 2px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-divider {
  height: 1px;
  background: #f0f0f0;
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

/* 个性装扮（动态背景）时，名片卡片毛玻璃半透明深底（与群邀请卡片一致） */
.share-card-wrap.has-dynamic-bg .msg-card {
  background: rgba(0, 0, 0, 0.34);
  border-color: rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.share-card-wrap.has-dynamic-bg .msg-title {
  color: #fff;
  text-shadow:
    0 1px 3px rgba(0, 0, 0, 0.75),
    0 0 8px rgba(0, 0, 0, 0.5);
}
.share-card-wrap.has-dynamic-bg .msg-subtitle,
.share-card-wrap.has-dynamic-bg .status-text {
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
}
.share-card-wrap.has-dynamic-bg .card-divider {
  background: rgba(255, 255, 255, 0.25);
}
.share-card-wrap.has-dynamic-bg .card-avatar {
  background: rgba(255, 255, 255, 0.15);
}

/* 详情弹窗 */
.share-detail-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.share-detail-card {
  width: 90%;
  max-width: 360px;
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
}

.detail-header {
  padding: 14px 18px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.detail-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
}

.detail-close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  color: #999;
}

.detail-close:hover {
  background: #f5f5f5;
}

.detail-body {
  padding: 20px 18px 22px;
  text-align: center;
}

.detail-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  margin-bottom: 12px;
  background: #eee;
}

.detail-name {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 600;
  color: #1a1a1a;
}

.detail-desc {
  margin: 0 0 16px;
  font-size: 13px;
  color: #999;
  line-height: 1.5;
}

.detail-id {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 14px;
  padding: 10px 12px;
  background: #f7f8fa;
  border-radius: 8px;
}

.detail-id-label {
  font-size: 12px;
  color: #999;
}

.detail-id-value {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  user-select: text;
}

.detail-action {
  width: 100%;
  padding: 10px 0;
  border: none;
  border-radius: 8px;
  background: #165dff;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
}

.detail-action:hover {
  background: #4080ff;
}

.detail-tip {
  margin: 12px 0 0;
  font-size: 12px;
  color: #bbb;
}
</style>
