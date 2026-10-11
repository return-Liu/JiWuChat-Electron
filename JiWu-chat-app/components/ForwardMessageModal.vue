<template>
  <Teleport to="body">
    <Transition name="forward-fade">
      <div v-if="visible" class="forward-mask" @click.self="handleClose">
        <div class="forward-modal" @click.stop>
          <!-- 头部 -->
          <div class="forward-header">
            <span class="forward-title">转发到</span>
            <button class="forward-close" type="button" @click="handleClose">✕</button>
          </div>

          <!-- 被转发消息预览 -->
          <div v-if="previewText" class="forward-preview">
            <span class="preview-tag">转发内容</span>
            <span class="preview-text">{{ previewText }}</span>
          </div>

          <!-- 搜索 -->
          <div class="forward-search">
            <input
              v-model="keyword"
              class="forward-search-input"
              type="text"
              placeholder="搜索联系人或群聊"
            />
          </div>

          <!-- 目标列表 -->
          <div class="forward-list">
            <template v-if="filteredContacts.length">
              <div
                v-for="contact in filteredContacts"
                :key="String(contact.id)"
                class="forward-item"
                :class="{ 'is-checked': selectedIds.has(String(contact.id)) }"
                @click="toggle(contact)"
              >
                <div class="item-checkbox">
                  <div
                    class="checkbox-circle"
                    :class="{ 'checkbox-checked': selectedIds.has(String(contact.id)) }"
                  >
                    <CheckOutlined v-if="selectedIds.has(String(contact.id))" class="checkmark" />
                  </div>
                </div>
                <a-avatar :size="34" :src="contact.avatar" class="item-avatar">
                  <template #fallback>
                    {{ (contact.remark || contact.name || "?").charAt(0) }}
                  </template>
                </a-avatar>
                <div class="item-info">
                  <div class="item-name">
                    {{ contact.remark || contact.name || "未知" }}
                    <span v-if="contact.isGroup" class="item-badge">群聊</span>
                  </div>
                  <div class="item-sub">
                    {{ contact.lastMessage || (contact.isGroup ? "群聊" : "好友") }}
                  </div>
                </div>
              </div>
            </template>
            <div v-else class="forward-empty">没有匹配的联系人或群聊</div>
          </div>

          <!-- 底部 -->
          <div class="forward-footer">
            <span class="footer-hint">
              {{ messageList.length }} 条消息 → {{ selectedIds.size }} 个会话{{
                isMediaMessage ? "（媒体会逐个重新上传）" : ""
              }}
            </span>
            <div class="footer-actions">
              <button class="footer-btn" type="button" @click="handleClose">取消</button>
              <button
                class="footer-btn primary"
                type="button"
                :disabled="!selectedIds.size || loading"
                @click="handleConfirm"
              >
                {{ loading ? "转发中…" : "转发" }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { CheckOutlined } from "@ant-design/icons-vue";
import type { ChatMessage, Contact } from "../types/chatTypes";
import { getForwardPreview } from "../untils/forwardMessage";

interface Props {
  visible: boolean;
  /** 待转发的消息列表（单条转发时长度为 1，多选批量转发时为多条） */
  messages: ChatMessage[];
  contacts: Contact[];
  /** 当前会话 id，用于默认置顶显示（不强制排除，允许转发回当前会话） */
  activeContactId?: string | number;
  loading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  messages: () => [],
  activeContactId: "",
  loading: false,
});

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void;
  (e: "confirm", targetIds: (string | number)[]): void;
}>();

const keyword = ref("");
const selectedIds = ref<Set<string>>(new Set());

/** 可选目标：排除「自己与自己聊天」的会话 */
const selectableContacts = computed<Contact[]>(() => {
  return (props.contacts || []).filter((c) => !c.isSelf && c.id !== undefined && c.id !== null);
});

const filteredContacts = computed<Contact[]>(() => {
  const kw = keyword.value.trim().toLowerCase();
  const list = selectableContacts.value;
  if (!kw) return list;
  return list.filter((c) =>
    [c.remark, c.name, c.username].some((v) => String(v || "").toLowerCase().includes(kw)),
  );
});

const messageList = computed(() => props.messages || []);

const previewText = computed(() => {
  const list = messageList.value;
  if (!list.length) return "";
  if (list.length === 1) return getForwardPreview(list[0]);
  return `${list.length} 条消息：${getForwardPreview(list[0])} 等`;
});

const isMediaMessage = computed(() =>
  messageList.value.some((m) => ["image", "video", "file"].includes(m?.messageType || "")),
);

const toggle = (contact: Contact) => {
  const id = String(contact.id);
  if (selectedIds.value.has(id)) {
    selectedIds.value.delete(id);
  } else {
    selectedIds.value.add(id);
  }
  // Set 变化不会自动触发，重建一次保证视图刷新
  selectedIds.value = new Set(selectedIds.value);
};

const handleClose = () => {
  if (props.loading) return;
  emit("update:visible", false);
};

const handleConfirm = () => {
  if (!selectedIds.value.size || props.loading) return;
  // 还原成原始 id（可能是 number）
  const targets = selectableContacts.value
    .filter((c) => selectedIds.value.has(String(c.id)))
    .map((c) => c.id);
  emit("confirm", targets);
};

// 每次打开时重置选择
watch(
  () => props.visible,
  (v) => {
    if (v) {
      selectedIds.value = new Set();
      keyword.value = "";
    }
  },
);
</script>

<style scoped>
.forward-mask {
  position: fixed;
  inset: 0;
  z-index: 10001;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}

.forward-modal {
  width: 420px;
  max-width: 92vw;
  max-height: 78vh;
  background: var(--card-bg, #ffffff);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}

.forward-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
}

.forward-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #1a1a2e);
}

.forward-close {
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-secondary, #999);
}

.forward-close:hover {
  background: var(--bg-tertiary, rgba(0, 0, 0, 0.05));
}

.forward-preview {
  display: flex;
  align-items: baseline;
  gap: 8px;
  padding: 10px 16px;
  background: var(--bg-tertiary, rgba(0, 0, 0, 0.03));
  border-bottom: 1px solid var(--border-color, rgba(0, 0, 0, 0.06));
}

.preview-tag {
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--tag-bg, rgba(0, 122, 255, 0.1));
  color: var(--tag-color, #007aff);
}

.preview-text {
  font-size: 12.5px;
  color: var(--text-secondary, #666);
  line-height: 1.4;
  word-break: break-all;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.forward-search {
  padding: 10px 16px;
}

.forward-search-input {
  width: 100%;
  height: 32px;
  padding: 0 10px;
  box-sizing: border-box;
  border: 1px solid var(--border-color, var(--border-color));
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #1a1a2e);
}

.forward-search-input:focus {
  border-color: var(--primary-color, #165dff);
}

.forward-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 8px 8px;
}

.forward-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.forward-item:hover {
  background: var(--bg-tertiary, rgba(0, 0, 0, 0.04));
}

.forward-item.is-checked {
  background: var(--selected-bg, rgba(0, 122, 255, 0.08));
}

.item-checkbox {
  flex-shrink: 0;
}

.checkbox-circle {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1.5px solid var(--border-normal, #c7c7c7);
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-primary, #ffffff);
}

.checkbox-checked {
  background: var(--primary-color, #165dff);
  border-color: var(--primary-color, #165dff);
}

.checkmark {
  color: #fff;
  font-size: 10px;
}

.item-avatar {
  flex-shrink: 0;
}

.item-info {
  flex: 1;
  min-width: 0;
}

.item-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13.5px;
  font-weight: 500;
  color: var(--text-primary, #1a1a2e);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-badge {
  flex-shrink: 0;
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--tag-bg, rgba(0, 122, 255, 0.1));
  color: var(--tag-color, #007aff);
}

.item-sub {
  font-size: 11.5px;
  color: var(--text-secondary, #999);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.forward-empty {
  padding: 28px 0;
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary, #999);
}

.forward-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-top: 1px solid var(--border-color, rgba(0, 0, 0, 0.08));
}

.footer-hint {
  font-size: 12px;
  color: var(--text-secondary, #999);
}

.footer-actions {
  display: flex;
  gap: 8px;
}

.footer-btn {
  height: 30px;
  padding: 0 14px;
  border: 1px solid var(--border-color, var(--border-color));
  border-radius: 6px;
  background: var(--bg-primary, #fff);
  color: var(--text-primary, #333);
  font-size: 13px;
  cursor: pointer;
}

.footer-btn:hover {
  background: var(--bg-tertiary, rgba(0, 0, 0, 0.04));
}

.footer-btn.primary {
  background: var(--primary-color, #165dff);
  border-color: var(--primary-color, #165dff);
  color: #fff;
}

.footer-btn.primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.forward-fade-enter-active,
.forward-fade-leave-active {
  transition: opacity 0.18s ease;
}

.forward-fade-enter-from,
.forward-fade-leave-to {
  opacity: 0;
}
</style>
