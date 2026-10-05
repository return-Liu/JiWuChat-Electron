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

      <!-- 同步状态提示：位于搜索框与第一个联系人之间 -->
      <div v-if="syncLabel" class="contact-sync-status" :class="syncState">
        <span v-if="syncState === 'syncing'" class="sync-loading-bar"></span>
        <span class="sync-text">{{ syncLabel }}</span>
        <button v-if="syncState === 'failed'" class="sync-retry" type="button" @click="emit('syncRetry')">
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
  // 🔥 新增：待处理群聊申请数量
  pendingGroupApplicationCount?: number;
  // 🔥 新增：待处理好友申请数量
  pendingFriendApplicationCount?: number;
  // 同步状态提示（搜索框与联系人列表之间）
  syncState?: "idle" | "syncing" | "synced" | "failed";
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
  // 🔥 新增：关闭抽屉事件
  closeDrawer: [];
  // 🔥 新增：刷新群聊申请数量
  refreshGroupApplicationCount: [];
  // 🔥 新增：刷新好友申请数量
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

const showCreateGroupModal = ref(false);
const showInviteFriendsForCreateModal = ref(false); // 新增：用于创建群聊前选择好友的模态框
const showAddMembersAfterCreateModal = ref(false);
const tempCreatedGroupId = ref<number | undefined>(undefined);

// 选中的好友 ID 列表（用于创建群聊时作为初始成员）
const selectedFriendIdsForCreate = ref<number[]>([]);

const activeTab = ref("friend");
const friendCategoryExpanded = ref(false);
const groupCategoryExpanded = ref(false);

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

const currentColorPalette = computed(() => {
  return siderColorStore.currentColorPalette;
});

// ✅ 直接使用 Store 配置，移除复杂的条件判断
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

    // 搜索框 / 加号按钮：动态主题下改为半透明 + 白色图标文字，避免在壁纸上出现浅色块
    "--search-bg": isDynamic ? "rgba(0, 0, 0, 0.28)" : "#f5f5f5",
    "--search-text-color": isDynamic ? "#ffffff" : "#333333",
    "--search-placeholder-color": isDynamic ? "rgba(255, 255, 255, 0.7)" : "#999999",
    "--search-icon-color": isDynamic ? "rgba(255, 255, 255, 0.85)" : "#999999",
    "--search-icon-hover-color": isDynamic ? "#ffffff" : "#666666",
    "--action-btn-bg": isDynamic ? "rgba(0, 0, 0, 0.28)" : "#f5f5f5",
    "--action-btn-color": isDynamic ? "rgba(255, 255, 255, 0.9)" : "#666666",

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
const isDefaultTopContact = (contactId: string): boolean => {
  return (
    props.contacts.length > 0 &&
    (contactId === "current-user" || contactId === props.contacts[0].id)
  );
};

const handleContactClick = async (contactId: string) => {
  emit("contactSelect", contactId);
};

const clearSearchQuery = () => {
  searchQuery.value = "";
  if (typeof window !== "undefined") {
    localStorage.removeItem(`middleArea_searchQuery_${props.contentType}`);
  }
};

const refreshContactRemark = async (contactId: string) => {
  emit("refreshContacts");
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

const refreshUnreadCountOnDemand = async () => {
  console.log("[按需加载] 刷新未读消息数");
};

onMounted(() => {
  loadContactsData();
});

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
  // Reset form data if needed or just close
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
  invitedFriendIds?: number[]; // 新增：接收邀请的好友 ID 列表
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
      invitedFriendIds: data.invitedFriendIds || [], // 使用传入的邀请好友 ID 列表
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

// 同步状态提示：无背景，纯文字 + 左侧加载条，悬浮在列表上方、层级高
.contact-sync-status {
  position: absolute;
  top: 68px; // 搜索框下方，浮在第一个联系人上方
  left: 50%;
  transform: translateX(-50%);
  z-index: 999; // 高于联系人列表，确保悬浮可见
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  line-height: 1;
  white-space: nowrap;
  color: var(--text-secondary, #64748b);
  user-select: none;

  // 圆形加载条：文字左侧的旋转圆点
  .sync-loading-bar {
    width: 12px;
    height: 12px;
    border: 2px solid var(--border-color, rgba(0, 0, 0, 0.15));
    border-top-color: var(--purple-color, #8b5cf6);
    border-radius: 50%;
    animation: sync-spin 0.8s linear infinite;
  }

  &.failed {
    color: var(--error-color, #ef4444);
  }

  .sync-retry {
    padding: 0 8px;
    font-size: 12px;
    color: var(--purple-color, #8b5cf6);
    background: transparent;
    border: 1px solid var(--purple-color, #8b5cf6);
    border-radius: 10px;
    cursor: pointer;

    &:hover {
      color: #fff;
      background: var(--purple-color, #8b5cf6);
    }
  }
}

@keyframes sync-spin {
  to {
    transform: rotate(360deg);
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
