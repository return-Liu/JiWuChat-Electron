<template>
  <div class="qq-middle-area-wrapper">
    <div class="qq-middle-area" :style="middleAreaStyle">
      <div class="search-bar" :style="searchBarStyle">
        <div class="search-container">
          <div class="search-icon">
            <i class="iconfont icon-sousuo"></i>
          </div>
          <input
            v-model="searchQuery"
            @input="handleSearchInput"
            :placeholder="placeholder"
            class="search-input"
            type="text"
          />
          <div v-if="searchQuery" class="clear-search" @click="clearSearchQuery">
            <i class="iconfont icon-zuixing-81"></i>
          </div>
        </div>

        <div class="action-menu">
          <a-dropdown trigger="click">
            <div class="action-button">
              <i class="iconfont icon-jiahao1 menu-icon"></i>
            </div>
            <template #overlay>
              <a-menu @click="handleMenuClick">
                <template v-if="contentType === 'message'">
                  <a-menu-item key="createGroup">
                    <div class="menu-item">
                      <i class="iconfont icon-chuangjianqunliao menu-icon menu-icon-fixed"></i>
                      <span class="menu-text">创建群聊</span>
                    </div>
                  </a-menu-item>
                </template>
                <template v-else-if="contentType === 'friend'">
                  <a-menu-item key="addFriend">
                    <div class="menu-item">
                      <i class="iconfont icon-tianjiahaoyou menu-icon menu-icon-fixed"></i>
                      <span class="menu-text">添加好友</span>
                    </div>
                  </a-menu-item>
                  <a-menu-item key="joinGroup">
                    <div class="menu-item">
                      <i class="iconfont icon-tianjiaqunliao menu-icon menu-icon-fixed"></i>
                      <span class="menu-text">添加群聊</span>
                    </div>
                  </a-menu-item>
                </template>
                <template v-else-if="contentType === 'group'">
                  <a-menu-item key="createGroup">
                    <div class="menu-item">
                      <i class="iconfont icon-chuangjianqunliao menu-icon menu-icon-fixed"></i>
                      <span class="menu-text">创建群聊</span>
                    </div>
                  </a-menu-item>
                  <a-menu-item key="joinGroup">
                    <div class="menu-item">
                      <i class="iconfont icon-tianjiaqunliao menu-icon menu-icon-fixed"></i>
                      <span class="menu-text">添加群聊</span>
                    </div>
                  </a-menu-item>
                </template>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </div>

      <!-- 连接 + 同步：合并为一条状态提示（位于搜索框与联系人列表之间）。
           断线时重连与同步是同时发生的，文案合并显示，如「正在重新连接中… 同步中…」；
           连接正常时只显示同步段。 -->
      <div
        v-if="mergedStatus"
        class="contact-sync-status"
        :class="[mergedStatus.tone, { 'is-dynamic': siderColorStore.hasDynamicBackground }]"
      >
        <span class="sync-badge">
          <LoadingOutlined v-if="mergedStatus.spinning" class="sync-icon" spin />
          <CheckCircleOutlined v-else-if="mergedStatus.tone === 'synced'" class="sync-icon" />
          <CloseCircleOutlined v-else class="sync-icon" />
        </span>
        <span class="sync-text">{{ mergedStatus.text }}</span>
        <button
          v-if="mergedStatus.showRetry"
          class="sync-retry"
          type="button"
          @click="emit('syncRetry')"
        >
          重试
        </button>
      </div>
      <ContactList
        :content-type="contentType"
        :contacts="props.contacts"
        :friends="props.friends"
        :groups="props.groups"
        :active-contact-id="props.activeContactId"
        :search-query="searchQuery"
        :placeholder="placeholder"
        :unread-message-count="totalUnreadCount"
        @contact-select="handleContactClick"
        @close-drawer="emit('closeDrawer')"
        @friend-notice-click="emit('friendNoticeClick')"
        @group-notice-click="emit('groupNoticeClick')"
      />

      <CreateGroupModal
        :visible="showCreateGroupModal"
        @update:visible="handleCreateGroupModalVisibleChange"
        :groupFormData="groupFormData"
        @update:groupFormData="groupFormData = $event"
        :invited-friend-ids="selectedFriendIdsForCreate"
        :is-submitting="creatingGroup"
        @confirm-create-group="handleCreateGroupSubmit"
        @close="handleCreateGroupClose"
      />

      <!-- 邀请好友模态框（用于创建群聊前选择好友） -->
      <AddGroupMemberModal
        :visible="showInviteFriendsForCreateModal"
        @update:visible="showInviteFriendsForCreateModal = $event"
        :invited-friend-ids="selectedFriendIdsForCreate"
        @confirm-select="handleConfirmSelectFriendsForCreate"
      />

      <AddGroupMemberModal
        :visible="showAddMembersAfterCreateModal"
        @update:visible="showAddMembersAfterCreateModal = $event"
        :group-id="tempCreatedGroupId"
        :group-members="[]"
        @refresh-contacts="handleAddMembersSuccess"
      />

      <JoinGroupModal
        :visible="showJoinGroupModal"
        @update:visible="showJoinGroupModal = $event"
        :is-submitting="isSubmitting"
        @close="handleJoinGroupClose"
        @success="handleJoinGroupSuccess"
      />

      <AddFriendModal
        :visible="showAddFriendModal"
        @update:visible="showAddFriendModal = $event"
        :current-contact-id="Number(currentActiveContactId) || 0"
        @success="handleAddFriendSuccess"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { message, Modal } from "ant-design-vue";
import { LoadingOutlined, CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons-vue";

import { useSiderColor } from "../stores/siderColor";
import { useUserStore } from "../stores/user";
import request from "../untils/request";
import type { ChatMessage, Contact } from "../types/chatTypes";

import {
  getTopStatusFromLocalStorage,
  getMuteStatusFromLocalStorage,
  saveTopStatusToLocalStorage,
  saveMuteStatusToLocalStorage,
  handleToggleTop as toggleTop,
} from "../untils/contactManager";

interface GroupInfo {
  id: string;
  name: string;
  avatar: string;
  desc?: string;
  groupNumber: string;
  memberCount?: number;
  maxMembers?: number;
  createdAt: string;
  owner?: {
    nickname: string;
    id: string;
  };
  rule?: string;
  isPrivate?: boolean;
}

interface Application {
  id: string;
  groupName: string;
  groupNumber: string;
  avatar: string;
  status: string;
  createdAt: string;
  message?: string;
}

interface GroupFormData {
  groupName: string;
  rule: string;
  isPrivate: boolean;
  requireApproval: boolean;
  maxMembers: number;
  category: string;
  description: string;
}

interface Friend {
  id: string;
  name: string;
  avatar: string;
  bio?: string;
  isOnline?: boolean;
  remark?: string;
}

interface Props {
  contentType: "message" | "friend" | "group";
  contacts?: Contact[];
  friends?: Array<{
    id: string;
    name: string;
    avatar: string;
    bio?: string;
    isOnline?: boolean;
    remark?: string;
  }>;
  groups?: Array<{
    id: string;
    name: string;
    avatar: string;
    bio?: string;
    isOnline?: boolean;
    remark?: string;
    isGroup?: boolean;
    groupNumber?: string;
    memberCount?: number;
    isAdmin?: boolean;
  }>;
  activeContactId?: string;
  noContentTip?: string;
  placeholder?: string;
  currentUserId?: string;
  unreadMessageCount?: number;
  // 待处理群聊申请数量
  pendingGroupApplicationCount?: number;
  // 待处理好友申请数量
  pendingFriendApplicationCount?: number;
  // 同步状态（搜索框与联系人列表之间），由父组件驱动
  syncState?: "idle" | "syncing" | "synced" | "failed";
  // 同步文案覆盖（可选，不传则使用内部默认文案）
  syncLabel?: string;
}

const props = withDefaults(defineProps<Props>(), {
  contentType: "message",
  contacts: () => [],
  friends: () => [],
  groups: () => [],
  noContentTip: "暂无联系人",
  placeholder: "搜索",
  unreadMessageCount: 0,
  pendingGroupApplicationCount: 0,
  pendingFriendApplicationCount: 0,
  syncState: "idle",
  syncLabel: "",
});
const emit = defineEmits<{
  contactSelect: [id: string];
  groupCreated: [];
  updateContact: [contact: any];
  refreshContacts: [];
  // 关闭抽屉事件
  closeDrawer: [];
  // 刷新群聊申请数量
  refreshGroupApplicationCount: [];
  // 刷新好友申请数量
  refreshFriendApplicationCount: [];
  // 好友通知 / 群通知入口（转发自 ContactList，交由父组件在右栏展示）
  friendNoticeClick: [];
  groupNoticeClick: [];
  // 同步失败重试
  syncRetry: [];
}>();

const userStore = useUserStore();
const siderColorStore = useSiderColor();
const searchQuery = ref("");
const isSubmitting = ref(false);

// ============================================================
// WebSocket 连接状态（显示在搜索框下方，不再占用聊天界面）
// ============================================================
const connectionStatus = ref<"connected" | "connecting" | "disconnected">("connected");

/**
 * 连接段文案：仅在非「已连接」时出现。
 * 客户端断线后会自动重连，因此 connecting / disconnected 表现一致，
 * 统一显示为「正在重新连接中…」。
 */
const connectionSegment = computed(() =>
  connectionStatus.value === "connected" ? "" : "正在重新连接中…",
);

const showCreateGroupModal = ref(false);
const showInviteFriendsForCreateModal = ref(false);
const showAddMembersAfterCreateModal = ref(false);
const tempCreatedGroupId = ref<number | undefined>(undefined);

// 选中的好友 ID 列表（用于创建群聊时作为初始成员）
const selectedFriendIdsForCreate = ref<number[]>([]);

const groupFormData = ref<GroupFormData>({
  groupName: "",
  isPrivate: false,
  requireApproval: false,
  maxMembers: 100,
  rule: "",
  category: "friends",
  description: "",
});

const creatingGroup = ref(false);

const loadingStage = ref(0);
const isInitialized = ref(false);

const totalUnreadCount = computed(() => {
  if (props.unreadMessageCount && props.unreadMessageCount > 0) {
    return props.unreadMessageCount;
  }
  return (props.contacts || []).reduce((total, contact) => {
    return total + (contact.unreadCount || 0);
  }, 0);
});

/** 同步段文案：优先使用父组件传入的 syncLabel，否则用简短默认文案 */
const syncSegment = computed(() => {
  if (props.syncLabel) return props.syncLabel;
  switch (props.syncState) {
    case "syncing":
      return "同步中…";
    case "synced":
      return "已同步";
    case "failed":
      return "同步失败";
    default:
      return "";
  }
});

/**
 * 连接状态与同步状态共用的单条提示。
 *
 * 优先级：断线时只显示「正在重新连接中…」（此时同步没有意义），
 * 连接恢复后才显示同步段（同步中… / 已同步 / 同步失败）。
 * 两段都为空则不渲染。
 */
const mergedStatus = computed(() => {
  const connected = connectionStatus.value === "connected";
  // 断线时只提示重连；同步状态等连接恢复后再展示，两者不同时出现
  const text = connected ? syncSegment.value : connectionSegment.value;

  if (!text) return null;

  return {
    text,
    // 未连接时统一按「连接中」的灰底展示（正在重连，不是失败态）
    tone: connected ? props.syncState : "connecting",
    // 重连中 / 同步中 → 转圈
    spinning: connected ? props.syncState === "syncing" : true,
    // 仅同步失败才需要手动重试；断线是自动重连，无需入口
    showRetry: props.syncState === "failed",
  };
});

const currentColorPalette = computed(() => {
  return siderColorStore.currentColorPalette;
});

// 直接使用 Store 配置，移除复杂的条件判断
const middleAreaStyle = computed(() => {
  const palette = currentColorPalette.value;
  // 个性装扮（动态背景）时：主色改用从壁纸吸取的颜色，搜索框/按钮改为半透明，文字转白
  const isDynamic = siderColorStore.hasDynamicBackground;

  return {
    "--primary-color": isDynamic ? siderColorStore.dynamicAccent : palette.color,
    "--primary-hover-color": palette.hover,
    "--primary-active-color": palette.active,
    "--primary-light-color": palette.light,
    "--primary-text-color": palette.text,

    // 搜索框 / 加号按钮：
    // - 动态主题：半透明深底 + 白色图标文字，避免在壁纸上出现浅色块；
    // - 其余情况：一律用主题变量（夜间自动转深底浅字），
    //   不能写死 #f5f5f5 / #333，否则夜间仍是日间的浅灰块。
    "--search-bg": isDynamic ? "rgba(0, 0, 0, 0.28)" : "var(--bg-tertiary)",
    "--search-text-color": isDynamic ? "#ffffff" : "var(--text-primary)",
    "--search-placeholder-color": isDynamic
      ? "rgba(255, 255, 255, 0.7)"
      : "var(--text-tertiary)",
    "--search-icon-color": isDynamic
      ? "rgba(255, 255, 255, 0.85)"
      : "var(--text-secondary)",
    "--search-icon-hover-color": isDynamic ? "#ffffff" : "var(--text-primary)",
    "--action-btn-bg": isDynamic ? "rgba(0, 0, 0, 0.28)" : "var(--bg-tertiary)",
    "--action-btn-color": isDynamic
      ? "rgba(255, 255, 255, 0.9)"
      : "var(--text-secondary)",

    // 直接使用 Store 中的联系人列表项颜色配置
    "--bg-hover": siderColorStore.contactItemHoverBg,
    "--bg-active": siderColorStore.contactItemActiveBg,
    "--bg-top": `${palette.light}80`,
    "--online-color": palette.color,
    "--unread-color": palette.color,

    "--btn-hover-bg": siderColorStore.contactItemHoverBg,
    "--btn-hover-color": palette.color,

    "--item-hover-bg": siderColorStore.contactItemHoverBg,
    "--item-active-bg": siderColorStore.contactItemActiveBg,
    "--item-top-bg": `${palette.light}80`,

    "--chat-bg-gradient": siderColorStore.chatBgGradient,
    "--chat-bg-start": siderColorStore.chatBgStartColor,
    "--chat-bg-middle": siderColorStore.chatBgMiddleColor || siderColorStore.chatBgStartColor,
    "--chat-bg-end": siderColorStore.chatBgEndColor,
    // 个性装扮（动态背景）时，联系人列表全透明，透出底层视频/图片
    "--content-bg": siderColorStore.hasDynamicBackground
      ? "transparent"
      : siderColorStore.chatBgGradient,
    background: "transparent",
  };
});

// 搜索区域的主题渐变背景样式
const searchBarStyle = computed(() => {
  return {
    // 个性装扮（动态背景）时全透明，透出底层视频/图片
    background: siderColorStore.hasDynamicBackground
      ? "transparent"
      : siderColorStore.chatBgGradient,
  };
});

const savedSearchQuery =
  typeof window !== "undefined"
    ? localStorage.getItem(`middleArea_searchQuery_${props.contentType}`) || ""
    : "";
if (savedSearchQuery) searchQuery.value = savedSearchQuery;
watch(
  () => props.contacts,
  () => {
    if (!searchQuery.value) {
      const saved =
        typeof window !== "undefined"
          ? localStorage.getItem(`middleArea_searchQuery_${props.contentType}`) || ""
          : "";
      if (saved) searchQuery.value = saved;
    }
  },
  { deep: true },
);

const currentActiveContactId = computed(() => props.activeContactId || "");

const handleContactClick = async (contactId: string) => {
  emit("contactSelect", contactId);
};

const clearSearchQuery = () => {
  searchQuery.value = "";
  if (typeof window !== "undefined") {
    localStorage.removeItem(`middleArea_searchQuery_${props.contentType}`);
  }
};

const handleMenuClick = ({ key }: { key: string }) => {
  if (key === "createGroup") {
    openCreateGroupModal();
  } else if (key === "joinGroup") {
    openJoinGroupModal();
  } else if (key === "addFriend") {
    openAddFriendModal();
  }
};

const openJoinGroupModal = () => {
  showJoinGroupModal.value = true;
};

const closeJoinGroupModal = () => {
  showJoinGroupModal.value = false;
};

const handleJoinGroupSuccess = () => {
  emit("refreshContacts");
};

import {
  handleSendMessage,
  getChatHistory,
  handleUpdateGroupRule,
  handleEditRemark,
  handleSearchChatHistory,
  initContactTopAndMuteStatus,
  sortContacts,
  globalOriginalOrderManager,
  ensureOriginalOrderInitialized,
} from "../untils/contactManager";

const loadContactsData = async () => {
  if (isInitialized.value) return;

  try {
    loadingStage.value = 1;
    await new Promise((resolve) => setTimeout(resolve, 100));

    loadingStage.value = 2;
    if (props.contacts && Array.isArray(props.contacts)) {
      const validContacts = props.contacts.map((contact) => ({
        ...contact,
        isOnline: contact.isOnline ?? false,
        messages: contact.messages ?? [],
        lastMessage: contact.lastMessage ?? "",
        lastMessageTime: contact.lastMessageTime ?? "",
        unreadCount: contact.unreadCount ?? 0,
      })) as Contact[];
      initContactTopAndMuteStatus(validContacts);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));

    loadingStage.value = 3;
    if (props.contacts && Array.isArray(props.contacts) && userStore.userInfo?.id) {
      const validContacts = props.contacts.map((contact) => ({
        ...contact,
        isOnline: contact.isOnline ?? false,
        messages: contact.messages ?? [],
        lastMessage: contact.lastMessage ?? "",
        lastMessageTime: contact.lastMessageTime ?? "",
        unreadCount: contact.unreadCount ?? 0,
      })) as Contact[];
      sortContacts(
        validContacts,
        String(userStore.userInfo.id),
        globalOriginalOrderManager.getMap(),
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 100));

    loadingStage.value = 4;
    isInitialized.value = true;
    loadingStage.value = 5;
  } catch (error) {
    console.error("[懒加载] 初始化失败:", error);
  }
};

onMounted(() => {
  loadContactsData();
  initWebSocketStatus();
});

/** 订阅 WebSocket 连接状态变化 */
function initWebSocketStatus() {
  let offHandler: (() => void) | null = null;

  import("../untils/websocket")
    .then(({ websocketService }) => {
      connectionStatus.value = websocketService.isConnected() ? "connected" : "disconnected";

      const handleConnectionStatus = (status: { connected: boolean }) => {
        connectionStatus.value = status.connected ? "connected" : "disconnected";
      };

      websocketService.on("connection_status", handleConnectionStatus);
      offHandler = () => websocketService.off("connection_status", handleConnectionStatus);
    })
    .catch(() => {
      connectionStatus.value = "disconnected";
    });

  onUnmounted(() => {
    offHandler?.();
  });
}

watch(
  () => props.contacts,
  (newContacts) => {
    if (newContacts && Array.isArray(newContacts) && newContacts.length > 0) {
      const validContacts = newContacts.map((contact) => ({
        ...contact,
        isOnline: contact.isOnline ?? false,
        messages: contact.messages ?? [],
        lastMessage: contact.lastMessage ?? "",
        lastMessageTime: contact.lastMessageTime ?? "",
        unreadCount: contact.unreadCount ?? 0,
      })) as Contact[];
      ensureOriginalOrderInitialized(validContacts);
      initContactTopAndMuteStatus(validContacts);
      if (userStore.userInfo?.id) {
        sortContacts(
          validContacts,
          String(userStore.userInfo.id),
          globalOriginalOrderManager.getMap(),
        );
      }
    }
  },
  { deep: true },
);

const openCreateGroupModal = () => {
  // 重置选中的好友
  selectedFriendIdsForCreate.value = [];

  // 打开选择好友模态框
  showInviteFriendsForCreateModal.value = true;
};

// 处理确认选择好友事件（用于创建群聊）
const handleConfirmSelectFriendsForCreate = (friendIds: number[]) => {
  if (friendIds.length === 0) {
    message.warning("请至少选择一位好友");
    return;
  }

  // 保存选中的好友 ID
  selectedFriendIdsForCreate.value = friendIds;

  // 关闭选择好友模态框
  showInviteFriendsForCreateModal.value = false;

  // 打开创建群聊模态框
  showCreateGroupModal.value = true;
};

const showJoinGroupModal = ref(false);

const handleCreateGroupSuccess = () => {
  emit("groupCreated");
};

const handleCreateGroupClose = () => {
  // 重置表单数据或直接关闭
};

const handleCreateGroupModalVisibleChange = (visible: boolean) => {
  showCreateGroupModal.value = visible;
  if (!visible) {
    // 模态框关闭时重置临时群组ID和选中的好友
    tempCreatedGroupId.value = undefined;
    selectedFriendIdsForCreate.value = [];
  }
};

const handleJoinGroupClose = () => {
  showJoinGroupModal.value = false;
};

const handleCreateGroupSubmit = async (data: {
  groupData: typeof groupFormData.value;
  avatarFile: File | null;
  avatarUrl: string;
  invitedFriendIds?: number[];
}) => {
  creatingGroup.value = true;
  try {
    let finalAvatarUrl = "";
    if (data.avatarFile) {
      const formData = new FormData();
      formData.append("groupavatar", data.avatarFile);
      const avatarResponse = await request.post("/groupavatar/upload-for-create", formData);
      finalAvatarUrl = avatarResponse.data.avatar;
    }

    // 创建群聊时邀请选中的好友
    const groupData = {
      name: data.groupData.groupName,
      requireApproval: data.groupData.requireApproval,
      maxMembers: data.groupData.maxMembers,
      rule: data.groupData.rule || "",
      avatar: finalAvatarUrl,
      isPrivate: data.groupData.isPrivate || false,
      category: data.groupData.category || "friends",
      description: data.groupData.description || "",
      invitedFriendIds: data.invitedFriendIds || [],
    };

    const response = await request.post("/group/create-with-invites", groupData);

    message.success(response.data.message || "群聊创建成功");

    // 保存新创建的群组ID，并打开添加成员模态框
    if (response.data.data && response.data.data.id) {
      tempCreatedGroupId.value = response.data.data.id;
      showCreateGroupModal.value = false;

      // 如果有邀请好友，显示提示
      if (data.invitedFriendIds && data.invitedFriendIds.length > 0) {
        message.success(`已邀请 ${data.invitedFriendIds.length} 位好友加入群聊`);
      }

      // 清空选中的好友
      selectedFriendIdsForCreate.value = [];

      // 延迟一下再打开添加成员模态框，确保UI流畅
      setTimeout(() => {
        showAddMembersAfterCreateModal.value = true;
      }, 300);
    } else {
      showCreateGroupModal.value = false;
      // 清空选中的好友
      selectedFriendIdsForCreate.value = [];
      setTimeout(() => {
        emit("groupCreated");
      }, 100);
    }
  } catch (error: any) {
    console.error("创建群聊失败:", error);
    const errorMessage =
      error.response?.data?.data?.message || error.response?.data?.message || "创建群聊失败";
    message.error(errorMessage);
  } finally {
    creatingGroup.value = false;
  }
};

const showAddFriendModal = ref(false);
const openAddFriendModal = () => {
  showAddFriendModal.value = true;
};
const handleAddFriendSuccess = () => {
  if (props.contentType === "friend") {
    emit("refreshContacts");
  }
};

const handleAddMembersSuccess = () => {
  emit("refreshContacts");
  showAddMembersAfterCreateModal.value = false;
  tempCreatedGroupId.value = undefined;
};

const handleSearchInput = () => {};
</script>

<style lang="scss" scoped>
@use "../assets/scss/middleuser.scss";

// 同步状态提示：位于搜索框与联系人列表之间的轻量状态条。
// 设计：柔和的浅底小标签（浅灰/淡绿/淡红），有质感但不抢视线，圆角柔和。
.contact-sync-status {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  align-self: center;
  flex-shrink: 0;
  height: 24px;
  margin: 8px auto 4px;
  padding: 0 12px;
  font-size: 12px;
  line-height: 1;
  font-weight: 400;
  letter-spacing: 0.2px;
  white-space: nowrap;
  border-radius: 999px;
  user-select: none;
  pointer-events: none;
  animation: sync-fade-in 0.24s ease-out;

  .sync-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 13px;
    height: 13px;
    flex-shrink: 0;
  }

  .sync-icon {
    display: inline-flex;
    font-size: 12px;
    color: currentColor;
  }

  .sync-text {
    // 合并文案（如「正在重新连接中… 同步中…」）比单段更长，放宽上限
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  // 同步中：中性灰底，低调不抢视线
  &.syncing {
    color: var(--text-secondary, #64748b);
    background: color-mix(in srgb, var(--text-secondary, #64748b) 10%, transparent);
  }

  // 同步完成：淡绿底
  &.synced {
    color: var(--success-color, #22c55e);
    background: color-mix(in srgb, var(--success-color, #22c55e) 12%, transparent);
  }

  // 同步失败：淡红底，允许点击重试
  &.failed {
    color: var(--error-color, #ef4444);
    background: color-mix(in srgb, var(--error-color, #ef4444) 12%, transparent);
    pointer-events: auto;
  }

  // ===== 连接中：与同步段共用同一条胶囊 =====
  // 断线后是自动重连，按「进行中」的中性灰处理，不用失败红
  &.connecting {
    color: var(--text-secondary, #64748b);
    background: color-mix(in srgb, var(--text-secondary, #64748b) 10%, transparent);
  }

  // ===== 动态主题（个性装扮壁纸/视频背景）：转白字 + 深色半透明底 + 阴影 =====
  // 壁纸上半透明浅底会被背景吃掉，这里强制提高对比度，保证同步状态清晰可读
  &.is-dynamic {
    color: #ffffff;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
    background: rgba(0, 0, 0, 0.42);

    &.syncing,
    &.connecting {
      color: #ffffff;
      background: rgba(0, 0, 0, 0.42);
    }

    &.synced {
      color: #d1fae5;
      background: rgba(6, 78, 59, 0.55);
    }

    &.failed {
      color: #fecaca;
      background: rgba(127, 29, 29, 0.55);
    }
  }

  .sync-retry {
    margin-left: 2px;
    padding: 0;
    font-size: 11.5px;
    font-weight: 500;
    line-height: 1;
    color: inherit;
    background: transparent;
    border: none;
    text-decoration: underline;
    cursor: pointer;
    opacity: 0.9;

    &:hover {
      opacity: 1;
    }
  }
}

// 同步提示淡入动画（文档流布局，仅做透明度 + 轻微上移）
@keyframes sync-fade-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

// 修复菜单图标对齐问题
:deep(.menu-item) {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;

  .menu-icon-fixed {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    font-size: 18px !important;
    flex-shrink: 0;
    text-align: center;
    line-height: 1;
  }

  .menu-text {
    flex: 1;
    white-space: nowrap;
  }

  .menu-badge {
    margin-left: auto;
    flex-shrink: 0;
  }
}
</style>
