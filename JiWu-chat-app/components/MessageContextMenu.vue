<template>
  <Transition name="menu-pop">
    <div
      v-if="visible"
      ref="menuRef"
      class="context-menu"
      :class="{ 'is-dark': isDark }"
      :style="{ top: resolvedPosition.y + 'px', left: resolvedPosition.x + 'px' }"
      role="menu"
      @contextmenu.prevent
      @click.stop
    >
      <!-- 引用 -->
      <div
        v-if="canReplyMessage"
        class="menu-item tone-blue"
        role="menuitem"
        @click.stop="handleReply"
      >
        <span class="menu-icon-wrap"><i class="iconfont icon-yinyong"></i></span>
        <span class="menu-label">引用</span>
      </div>

      <div v-if="showFirstDivider" class="menu-divider"></div>

      <!-- 复制 -->
      <div
        v-if="canCopyMessage"
        class="menu-item tone-cyan"
        role="menuitem"
        @click.stop="handleCopy"
      >
        <span class="menu-icon-wrap"><i class="iconfont icon-fuzhi"></i></span>
        <span class="menu-label">复制</span>
      </div>

      <!-- 转发 -->
      <div
        v-if="canForwardMessage"
        class="menu-item tone-purple"
        role="menuitem"
        @click.stop="handleForward"
      >
        <span class="menu-icon-wrap"><i class="iconfont icon-zhuanfa"></i></span>
        <span class="menu-label">转发</span>
      </div>

      <!-- 多选 -->
      <div
        v-if="canMultiSelectMessage"
        class="menu-item tone-green"
        role="menuitem"
        @click.stop="handleMultiSelect"
      >
        <span class="menu-icon-wrap"><i class="iconfont icon-duoxuan"></i></span>
        <span class="menu-label">多选</span>
      </div>

      <!-- 撤回 -->
      <div
        v-if="canRecallMessage"
        class="menu-item tone-amber"
        role="menuitem"
        @click.stop="handleRecall"
      >
        <span class="menu-icon-wrap"><i class="iconfont icon-withdraw"></i></span>
        <span class="menu-label">撤回</span>
      </div>

      <div v-if="showDeleteDivider" class="menu-divider"></div>

      <!-- 删除 -->
      <div
        v-if="canDeleteMessage"
        class="menu-item tone-red"
        role="menuitem"
        @click.stop="handleDelete"
      >
        <span class="menu-icon-wrap"><i class="iconfont icon-shanchu"></i></span>
        <span class="menu-label">删除</span>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted, computed } from "vue";
import { message, Modal } from "ant-design-vue";
import request from "../untils/request";
import type { ChatMessage } from "../types/chatTypes";
import { useSiderColor } from "../stores/siderColor";
import {
  updateContactLastMessage,
  deleteMessage,
} from "../untils/contactManager";

interface Props {
  visible: boolean;
  position: { x: number; y: number };
  message: ChatMessage | null;
  contacts: any[];
  activeContactId: string | number | undefined;
  currentUserId: number; // 当前用户 ID，用于权限判断
}

const props = defineProps<Props>();

const siderColorStore = useSiderColor();
/** 夜间模式：菜单切换为深色毛玻璃 */
const isDark = computed(() => !!siderColorStore.systemPrefersDark);

const menuRef = ref<HTMLElement | null>(null);

/** 实际渲染使用的位置：在鼠标原始位置基础上做视口边界收敛后的结果 */
const resolvedPosition = ref({ x: 0, y: 0 });

/**
 * 边界收敛：菜单贴近视口右 / 下边缘时向左 / 上翻转，避免溢出被裁剪。
 * 在 nextTick（DOM 已更新、浏览器尚未绘制）里执行，不会产生闪烁。
 */
const clampPosition = () => {
  const el = menuRef.value;
  if (!el) return;

  const { x, y } = props.position;
  const margin = 8;
  const { width, height } = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = x;
  let top = y;
  if (left + width + margin > vw) left = Math.max(margin, x - width);
  if (top + height + margin > vh) top = Math.max(margin, y - height);

  resolvedPosition.value = {
    x: Math.max(margin, Math.min(left, vw - width - margin)),
    y: Math.max(margin, Math.min(top, vh - height - margin)),
  };
};

const emit = defineEmits<{
  (e: "delete", message: ChatMessage): void;
  (
    e: "recall",
    message: ChatMessage,
    originalContent?: string,
    recalledAt?: string,
  ): void;
  (e: "copy", message: ChatMessage): void;
  (e: "reply", message: ChatMessage): void;
  (e: "forward", message: ChatMessage): void;
  (e: "multiSelect", message: ChatMessage): void;
  (e: "close"): void;
}>();

// 当前激活的联系人（用于群权限判断）
const activeContact = computed(() =>
  props.contacts.find((c) => String(c.id) === String(props.activeContactId)),
);

// 当前用户是否为该群的群主或管理员
const isCurrentUserGroupOwnerOrAdmin = computed(() => {
  const contact = activeContact.value;
  if (!contact?.isGroup) return false;
  const uid = String(props.currentUserId);

  const ownerId = String(contact.groupOwnerId || contact.owner?.id || "").trim();
  if (ownerId && ownerId === uid) return true;

  const explicitAdmins = Array.isArray(contact.admin) ? contact.admin : [];
  const derivedAdmins = Array.isArray(contact.groupMembers)
    ? contact.groupMembers.filter(
        (m: any) => String(m?.role || "").toLowerCase() === "admin",
      )
    : [];

  return [...explicitAdmins, ...derivedAdmins].some((a: any) => {
    const aid = String(a?.id ?? a?.userId ?? a?.user?.id ?? "").trim();
    return aid === uid;
  });
});

/**
 * 是否为当前用户自己发送的消息。
 *
 * 优先用后端 / 上层已算好的 isMe（「自己与自己聊天」场景里对方也是自己，
 * senderId 与 currentUserId 虽相同，但气泡统一渲染在右侧，同样视为自己的消息）；
 * 未带 isMe 时回退按 senderId 比对。
 */
const isOwnMessage = computed(() => {
  if (!props.message) return false;
  if (props.message.isMe) return true;
  if (!props.currentUserId) return false;
  return String(props.message.senderId ?? "") === String(props.currentUserId);
});

// 计算属性：判断各种操作的可用性
const canReplyMessage = computed(() => {
  if (!props.message) return false;
  // 自己的消息不显示「引用」：自己不需要回复自己
  // （含「自己与自己聊天」场景，此时所有消息都不再出现引用项）
  return !isOwnMessage.value;
});

const canCopyMessage = computed(() => {
  if (!props.message) return false;
  // 文本、链接、名片、图片 / 视频 / 文件消息均可复制
  return [
    "text",
    "link",
    "share_user_card",
    "share_group_card",
    "image",
    "video",
    "file",
  ].includes(props.message.messageType || "text");
});

const canForwardMessage = computed(() => {
  if (!props.message) return false;
  // 除系统消息外的所有消息都可以转发
  return props.message.messageType !== "system";
});

const canMultiSelectMessage = computed(() => {
  if (!props.message) return false;
  // 除系统消息外的所有消息都可以多选
  return props.message.messageType !== "system";
});

const canRecallMessage = computed(() => {
  if (!props.message || !props.currentUserId) return false;

  // 只能撤回自己发送的消息
  if (!isOwnMessage.value) return false;

  // 已经撤回的消息不能再次撤回
  if (props.message.isRecalled) return false;

  // 检查是否在2分钟内（撤回时间窗口）
  let messageTime: number;

  // 优先使用 createdAt（ISO 格式时间字符串）
  if (props.message.createdAt) {
    // 使用 new Date() 解析时间
    messageTime = new Date(props.message.createdAt).getTime();
  }
  // 如果没有 createdAt，尝试使用 _timestamp（原始时间戳）
  else if ((props.message as any)._timestamp) {
    messageTime = (props.message as any)._timestamp;
  }
  // 最后尝试解析 time 字段
  else if (props.message.time) {
    const timeStr = props.message.time;
    // 如果包含"今天"，说明是格式化后的时间，无法用于计算
    if (timeStr.includes("今天") || timeStr.includes("昨天")) {
      // 无法确定准确时间，保守起见不允许撤回
      return false;
    }
    // 尝试解析为标准时间格式
    messageTime = new Date(timeStr).getTime();
  } else {
    // 没有时间信息，不允许撤回
    return false;
  }

  // 验证时间是否有效
  if (isNaN(messageTime)) {
    return false;
  }

  const currentTime = Date.now();
  const timeDiff = currentTime - messageTime;
  const twoMinutes = 2 * 60 * 1000; // 2分钟毫秒数

  return timeDiff <= twoMinutes;
});

const canDeleteMessage = computed(() => {
  if (!props.message || !props.currentUserId) return false;
  // 可以删除自己的消息
  if (isOwnMessage.value) return true;

  // 群主 / 管理员可以删除群内其他成员的消息
  return isCurrentUserGroupOwnerOrAdmin.value;
});

const showFirstDivider = computed(() => {
  // 分隔线是「引用」与后续操作之间的分隔：引用不显示时不能残留一条悬空分隔线
  return (
    canReplyMessage.value &&
    (canCopyMessage.value ||
      canForwardMessage.value ||
      canMultiSelectMessage.value ||
      canRecallMessage.value)
  );
});

const showDeleteDivider = computed(() => {
  return (
    canDeleteMessage.value &&
    (canCopyMessage.value ||
      canForwardMessage.value ||
      canMultiSelectMessage.value ||
      canRecallMessage.value)
  );
});

// 处理各种操作
const handleReply = () => {
  if (!props.message) return;
  emit("reply", props.message);
  emit("close");
};

// 提取可复制的文本：名片消息解析为「昵称 + UID/群号」，普通消息取原文
const getCopyText = (): string => {
  const m = props.message;
  if (!m) return "";
  const type = m.messageType || "text";

  if (type === "share_user_card" || type === "share_group_card") {
    try {
      const d = typeof m.content === "string" ? JSON.parse(m.content) : m.content || {};
      if (type === "share_user_card") {
        const u = d?.targetUser;
        const name = [u?.nickname, u?.username].filter(Boolean).join(" ");
        return name || (u?.uid ? `UID: ${u.uid}` : "");
      }
      const g = d?.targetGroup;
      return g?.name || (g?.groupNumber ? `群号: ${g.groupNumber}` : "");
    } catch {
      return m.content || "";
    }
  }

  // 文件消息：content 是 { url, filename, size } 的 JSON，复制可访问地址
  if (type === "file") {
    try {
      const d = typeof m.content === "string" ? JSON.parse(m.content) : m.content || {};
      return d?.url || m.content || "";
    } catch {
      return m.content || "";
    }
  }

  // 图片 / 视频：content 即为资源地址
  return m.content || "";
};

const handleCopy = async () => {
  if (!props.message) return;

  try {
    // 实际执行复制到剪贴板
    await navigator.clipboard.writeText(getCopyText());
  } catch (error) {
    console.error("复制失败:", error);
    message.error("复制失败");
  }

  emit("copy", props.message);
  emit("close");
};

const handleForward = () => {
  if (!props.message) return;
  emit("forward", props.message);
  emit("close");
};

const handleMultiSelect = () => {
  if (!props.message) return;
  emit("multiSelect", props.message);
  emit("close");
};

// 处理撤回
const handleRecall = async () => {
  if (!props.message) return;

  try {
    await new Promise<void>((resolve, reject) => {
      Modal.confirm({
        title: "撤回确认",
        content: "确定要撤回这条消息吗？",
        okText: "确定",
        cancelText: "取消",
        onOk: () => resolve(),
        onCancel: () => reject("cancel"),
      });
    });

    // 关键修复：在异步操作后再次检查 message 是否仍然有效
    if (!props.message) {
      message.warning("消息已失效，请重试");
      return;
    }

    // 保存原始内容到 recalledContent 字段
    const originalContent = props.message.content;

    const response = await request.post("/message/recall", {
      messageId: props.message.id,
    });

    // 关键修复：使用后端返回的 recalledAt 时间，而不是前端生成的时间
    const backendRecalledAt =
      response.data?.recalledAt || new Date().toISOString();

    // 发射 recall 事件，让父组件知道撤回成功，并传递原始内容和后端返回的时间
    emit("recall", props.message, originalContent, backendRecalledAt);
  } catch (error: any) {
    if (error !== "cancel") {
      console.error("撤回消息失败:", error);
      message.error(error.response?.data?.message || "撤回消息失败");
    }
  } finally {
    emit("close");
  }
};

// 处理删除 - 使用工具函数优化
const handleDelete = async () => {
  if (!props.message || !props.message.id) return;

  // 使用公共的deleteMessage函数，该函数已包含确认对话框和错误处理
  const success = await deleteMessage(props.message.id, true);

  if (success) {
    // 关键修复：在异步操作后再次检查 message 是否仍然有效
    if (!props.message) {
      message.warning("消息已失效，请重试");
      return;
    }

    // ✅ 后端成功后，发射 delete 事件让父组件更新数据
    emit("delete", props.message);
  }

  emit("close");
};

// 点击外部关闭菜单
const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement;
  if (!target.closest(".context-menu")) {
    emit("close");
  }
};

// 位置同步：先用鼠标原始位置渲染，再在绘制前测量并做边界收敛
watch(
  () => [props.visible, props.position],
  () => {
    if (!props.visible) return;
    resolvedPosition.value = { x: props.position.x, y: props.position.y };
    nextTick(clampPosition);
  },
  { immediate: true },
);

// 监听全局点击事件（菜单的关闭统一由这里负责）
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      nextTick(() => {
        document.addEventListener("click", handleClickOutside);
      });
    } else {
      document.removeEventListener("click", handleClickOutside);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<style lang="scss" scoped>
.context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 168px;
  padding: 4px;
  border-radius: 10px;
  background: var(--dt-panel-solid, var(--card-bg));
  border: 1px solid rgba(0, 0, 0, 0.08);
  box-shadow:
    0 6px 24px -6px rgba(0, 0, 0, 0.16),
    0 2px 6px rgba(0, 0, 0, 0.06);
  display: flex;
  flex-direction: column;
  max-height: 320px;
  overflow-y: auto;
}

/* 夜间模式 */
.context-menu.is-dark {
  background: #2c2c2e;
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow:
    0 6px 24px -6px rgba(0, 0, 0, 0.5),
    0 2px 6px rgba(0, 0, 0, 0.3);
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #1f2937;
  user-select: none;
  transition: background 0.12s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }
}

.is-dark .menu-item {
  color: #e5e7eb;

  &:hover {
    background: rgba(255, 255, 255, 0.07);
  }
}

/* 图标：纯线性图标，不加色块背景 */
.menu-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: #6b7280;

  i {
    font-size: 15px;
    line-height: 1;
  }
}

.is-dark .menu-icon-wrap {
  color: #9ca3af;
}

.menu-label {
  flex: 1;
}

/* 仅危险操作用红色区分 */
.tone-red .menu-icon-wrap,
.tone-red .menu-label {
  color: #ef4444;
}

.is-dark .tone-red .menu-icon-wrap,
.is-dark .tone-red .menu-label {
  color: #f87171;
}

.menu-divider {
  height: 1px;
  margin: 5px 8px;
  background: rgba(0, 0, 0, 0.07);
}

.is-dark .menu-divider {
  background: rgba(255, 255, 255, 0.1);
}

/* 弹出动画：只做淡入，不做位移和缩放 */
.menu-pop-enter-active {
  transition: opacity 0.12s ease;
}

.menu-pop-leave-active {
  transition: opacity 0.08s ease;
}

.menu-pop-enter-from,
.menu-pop-leave-to {
  opacity: 0;
}
</style>
