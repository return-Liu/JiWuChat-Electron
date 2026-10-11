<template>
  <div
    class="content-container"
    :class="{ 'has-dynamic-bg': siderColorStore.hasDynamicBackground }"
    :style="dynamicStyle"
  >
    <!-- ==================== 消息列表 ==================== -->
    <div v-if="contentType === 'message'" class="contact-list">
      <div
        v-for="contact in filteredContacts"
        :key="contact.id"
        class="contact-card"
        :class="{
          active: contact.id === currentActiveContactId,
          'is-top': contact.isTop,
          'is-muted': contact.isMuted,
        }"
        @click="handleContactClick(String(contact.id))"
      >
        <div class="contact-avatar-container">
          <div class="avatar-wrapper">
            <AvatarImage :src="contact.avatar" :name="contact.remark || contact.name" />
            <div v-if="contact.unreadCount && contact.unreadCount > 0" class="badge badge-unread">
              {{ contact.unreadCount > 99 ? "99+" : contact.unreadCount }}
            </div>
          </div>
        </div>

        <div class="contact-info">
          <!-- 第一行：名称（左） + 时间（右） -->
          <div class="contact-top-row">
            <h4 class="contact-name">
              {{ contact.remark || contact.name }}
            </h4>
            <span class="contact-time">{{ contact.lastMessageTime }}</span>
          </div>

          <!-- 第二行：最后消息（左，超长截断） + 置顶/免打扰/风险图标（右，常显） -->
          <div class="contact-bottom-row">
            <p class="message-text">{{ contact.lastMessage }}</p>
            <div class="contact-tags">
              <span
                v-if="isRiskGroup(contact)"
                class="meta-icon risk-icon"
                :title="riskTitle(contact)"
              >
                <WarningFilled />
              </span>
              <span v-if="contact.isTop" class="meta-icon" title="置顶">
                <PushpinOutlined />
              </span>
              <span v-if="contact.isMuted" class="meta-icon" title="免打扰">
                <BellFilled />
              </span>
            </div>
          </div>
        </div>
      </div>

      <div v-if="showNoContentTip" class="empty-state">
        <div class="empty-illustration">
          <svg viewBox="0 0 64 64" width="48" height="48" fill="none">
            <rect
              x="8"
              y="14"
              width="48"
              height="36"
              rx="6"
              stroke="currentColor"
              stroke-width="2"
              opacity="0.5"
            />
            <path
              d="M20 30h24M20 38h16"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              opacity="0.4"
            />
          </svg>
        </div>
        <p class="empty-text">还没有开始聊天</p>
      </div>
    </div>

    <!-- ==================== 好友 / 群聊 ==================== -->
    <div v-else-if="contentType === 'friend'" class="relationship-panel">
      <!-- 通知入口 -->
      <div class="notice-list">
        <div class="notice-item" @click="handleNoticeClick('friend')">
          <span class="notice-text">好友通知</span>
          <span class="notice-arrow">
            <i class="iconfont icon-arrow-right"></i>
          </span>
        </div>
        <div class="notice-item" @click="handleNoticeClick('group')">
          <span class="notice-text">群通知</span>
          <span class="notice-arrow">
            <i class="iconfont icon-arrow-right"></i>
          </span>
        </div>
      </div>

      <!-- Tab 切换栏 -->
      <div class="tab-bar">
        <div
          class="tab-item"
          :class="{ active: activeTab === 'friend' }"
          @click="activeTab = 'friend'"
        >
          <span>好友列表</span>
          <span v-if="friendUnreadCount > 0" class="tab-badge">
            {{ friendUnreadCount > 99 ? "99+" : friendUnreadCount }}
          </span>
        </div>
        <div
          class="tab-item"
          :class="{ active: activeTab === 'group' }"
          @click="activeTab = 'group'"
        >
          <span>群聊列表</span>
          <span v-if="groupUnreadCount > 0" class="tab-badge">
            {{ groupUnreadCount > 99 ? "99+" : groupUnreadCount }}
          </span>
        </div>
      </div>

      <div class="tab-content">
        <!-- ========== 好友列表 ========== -->
        <div v-show="activeTab === 'friend'" class="list-panel">
          <div class="category-collapse">
            <div v-for="category in friendCategories" :key="category.key" class="collapse-group">
              <div
                class="collapse-header"
                :class="{ expanded: category.expanded }"
                @click="toggleFriendCategory(category.key)"
              >
                <span class="collapse-arrow" :class="{ expanded: category.expanded }">
                  <i class="iconfont icon-arrow-right"></i>
                </span>
                <span class="collapse-title">{{ category.label }}</span>
                <span class="collapse-count">
                  {{ getFriendCountByCategory(category.key) }}
                </span>
              </div>

              <div v-show="category.expanded" class="collapse-body">
                <!-- 分组内：虚拟滚动容器 -->
                <VirtualList
                  :items="getFriendsByCategory(category.key)"
                  :item-height="66"
                  :buffer="4"
                  :min-count="15"
                  key-field="id"
                >
                  <template #default="{ item: friend }">
                    <div
                      class="contact-card"
                      :class="{ active: friend.id === currentActiveContactId }"
                      @click="handleContactClick(friend.id)"
                    >
                      <div class="contact-avatar-container">
                        <div class="avatar-wrapper">
                          <AvatarImage :src="friend.avatar" :name="friend.remark || friend.name" />
                          <div
                            v-if="shouldShowOnlineStatus(friend)"
                            class="badge badge-online"
                            :class="{ online: friend.isOnline }"
                          ></div>
                        </div>
                      </div>

                      <div class="contact-info">
                        <div class="contact-top-row">
                          <h4 class="contact-name">
                            {{ friend.remark || friend.name }}
                          </h4>
                          <span
                            v-if="shouldShowOnlineStatus(friend) && friend.isOnline"
                            class="meta-text online-status"
                          >
                            在线
                          </span>
                        </div>
                        <div class="contact-bottom-row">
                          <p class="message-text">
                            {{ friend.bio || "暂无个性签名" }}
                          </p>
                        </div>
                      </div>
                    </div>
                  </template>
                </VirtualList>

                <div
                  v-if="getFriendsByCategory(category.key).length === 0"
                  class="empty-category-inline"
                >
                  <p class="empty-text">还没有添加好友</p>
                </div>
              </div>
            </div>
          </div>

          <!-- 搜索结果 / 无分组普通列表：整体虚拟滚动 -->
          <template v-if="!showFriendCategories">
            <VirtualList
              :items="filteredFriends"
              :item-height="66"
              :buffer="4"
              :min-count="15"
              key-field="id"
            >
              <template #default="{ item: friend }">
                <div
                  class="contact-card"
                  :class="{ active: friend.id === currentActiveContactId }"
                  @click="handleContactClick(friend.id)"
                >
                  <div class="contact-avatar-container">
                    <div class="avatar-wrapper">
                      <AvatarImage :src="friend.avatar" :name="friend.remark || friend.name" />
                      <div
                        v-if="shouldShowOnlineStatus(friend)"
                        class="badge badge-online"
                        :class="{ online: friend.isOnline }"
                      ></div>
                    </div>
                  </div>

                  <div class="contact-info">
                    <div class="contact-top-row">
                      <h4 class="contact-name">
                        {{ friend.remark || friend.name }}
                      </h4>
                      <span
                        v-if="shouldShowOnlineStatus(friend) && friend.isOnline"
                        class="meta-text online-status"
                      >
                        在线
                      </span>
                    </div>
                    <div class="contact-bottom-row">
                      <p class="message-text">
                        {{ friend.bio || "暂无个性签名" }}
                      </p>
                    </div>
                  </div>
                </div>
              </template>
            </VirtualList>

            <div v-if="filteredFriends.length === 0" class="empty-category">
              <p class="empty-text">还没有添加好友</p>
            </div>
          </template>
        </div>

        <!-- ========== 群聊列表 ========== -->
        <div v-show="activeTab === 'group'" class="list-panel">
          <div class="category-collapse">
            <div v-for="category in groupCategories" :key="category.key" class="collapse-group">
              <div
                class="collapse-header"
                :class="{ expanded: category.expanded }"
                @click="toggleGroupCategory(category.key)"
              >
                <span class="collapse-arrow" :class="{ expanded: category.expanded }">
                  <i class="iconfont icon-arrow-right"></i>
                </span>
                <span class="collapse-title">{{ category.label }}</span>
                <span class="collapse-count">
                  {{ getGroupCountByCategory(category.key) }}
                </span>
              </div>

              <div v-show="category.expanded" class="collapse-body">
                <VirtualList
                  :items="getGroupsByCategory(category.key)"
                  :item-height="66"
                  :buffer="4"
                  :min-count="15"
                  key-field="id"
                >
                  <template #default="{ item: group }">
                    <div
                      class="contact-card group-card"
                      :class="{ active: group.id === currentActiveContactId }"
                      @click="handleContactClick(group.id)"
                    >
                      <div class="contact-avatar-container">
                        <div class="avatar-wrapper">
                          <AvatarImage
                            :src="group.avatar"
                            :name="group.remark || group.name"
                            :rounded="false"
                          />
                        </div>
                      </div>

                      <div class="contact-info">
                        <div class="contact-top-row">
                          <h4 class="contact-name">
                            {{ group.remark || group.name }}
                            <span class="group-meta"> ({{ group.memberCount }}人) </span>
                          </h4>
                          <span
                            v-if="isRiskGroup(group)"
                            class="meta-icon risk-icon"
                            :title="riskTitle(group)"
                          >
                            <WarningFilled />
                          </span>
                        </div>
                        <div class="contact-bottom-row">
                          <p class="message-text">
                            {{ group.bio || "暂无群公告" }}
                          </p>
                        </div>
                      </div>
                    </div>
                  </template>
                </VirtualList>

                <div
                  v-if="getGroupsByCategory(category.key).length === 0"
                  class="empty-category-inline"
                >
                  <p class="empty-text">还没有加入群聊</p>
                </div>
              </div>
            </div>
          </div>

          <template v-if="!showGroupCategories">
            <VirtualList
              :items="filteredGroups"
              :item-height="66"
              :buffer="4"
              :min-count="15"
              key-field="id"
            >
              <template #default="{ item: group }">
                <div
                  class="contact-card group-card"
                  :class="{ active: group.id === currentActiveContactId }"
                  @click="handleContactClick(group.id)"
                >
                  <div class="contact-avatar-container">
                    <div class="avatar-wrapper">
                      <AvatarImage
                        :src="group.avatar"
                        :name="group.remark || group.name"
                        :rounded="false"
                      />
                    </div>
                  </div>

                  <div class="contact-info">
                    <div class="contact-top-row">
                      <h4 class="contact-name">
                        {{ group.remark || group.name }}
                        <span class="group-meta"> ({{ group.memberCount }}人) </span>
                      </h4>
                    </div>
                    <div class="contact-bottom-row">
                      <p class="message-text">
                        {{ group.bio || "暂无群公告" }}
                      </p>
                    </div>
                  </div>
                </div>
              </template>
            </VirtualList>

            <div v-if="filteredGroups.length === 0" class="empty-category">
              <p class="empty-text">还没有加入群聊</p>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, reactive } from "vue";
import type { Contact } from "../types/chatTypes";
import { useUserStore } from "../stores/user";
import { useSiderColor } from "../stores/siderColor";
import { PushpinOutlined, BellFilled, WarningFilled } from "@ant-design/icons-vue";
import { shouldShowOnlineStatus as checkOnlineVisibility } from "../untils/levelUtils";
import AvatarImage from "./AvatarImage.vue";
import VirtualList from "./VirtualList.vue";

const siderColorStore = useSiderColor();

const dynamicStyle = computed(() => {
  const isDynamic = siderColorStore.hasDynamicBackground;
  return {
    "--bg-hover": siderColorStore.contactItemHoverBg,
    "--bg-active": siderColorStore.contactItemActiveBg,
    ...(isDynamic
      ? {
          "--text-primary": "#ffffff",
          "--text-secondary": "rgba(255, 255, 255, 0.8)",
          "--bg-primary": "rgba(0, 0, 0, 0.35)",
          "--success-color": "#4ade80",
          "--dynamic-overlay-alpha": String(siderColorStore.dynamicOverlayOpacity),
        }
      : {}),
  };
});

interface Friend {
  id: string;
  name: string;
  avatar: string;
  bio?: string;
  isOnline?: boolean;
  remark?: string;
  onlineVisibility?: number;
  category?: string;
}

interface Group {
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
  category?: string;
  role?: "owner" | "admin" | "member";
  isTop?: boolean;
  /** 群聊风险等级（QQ 式安全提醒） */
  riskLevel?: "normal" | "watch" | "warning" | "high" | "severe";
  riskReportCount?: number;
  riskReasons?: string[];
}

interface Props {
  contentType: "message" | "friend" | "group";
  contacts?: Contact[];
  friends?: Friend[];
  groups?: Group[];
  activeContactId?: string;
  searchQuery?: string;
  placeholder?: string;
  unreadMessageCount?: number;
}

const props = withDefaults(defineProps<Props>(), {
  contentType: "message",
  contacts: () => [],
  friends: () => [],
  groups: () => [],
  searchQuery: "",
  placeholder: "搜索",
  unreadMessageCount: 0,
});

const emit = defineEmits<{
  contactSelect: [id: string];
  closeDrawer: [];
  refreshContacts: [];
  friendNoticeClick: [];
  groupNoticeClick: [];
}>();

const userStore = useUserStore();

const activeTab = ref<"friend" | "group">("friend");

const currentActiveContactId = computed(() => props.activeContactId || "");

const shouldShowOnlineStatus = (friend: any): boolean => {
  // 机器人（好友分组 category === "robot"）不展示在线状态
  if (friend?.category === "robot") return false;
  const currentUserId = userStore.user?.id;
  return checkOnlineVisibility(
    {
      onlineVisibility: friend.onlineVisibility,
      status: friend.status,
      id: friend.id,
    },
    currentUserId,
    true,
  );
};

/** 风险等级 → 中文描述 */
const RISK_LEVEL_LABELS: Record<string, string> = {
  watch: "关注",
  warning: "存在风险",
  high: "较高风险",
  severe: "严重风险",
};

/**
 * 是否为「需要展示风险标记」的群聊。
 * normal / 未定义 不展示，避免正常群聊被误标。
 * 兼容消息列表的 Contact 与群聊列表的 Group 两种结构。
 */
const isRiskGroup = (item: Contact | Group): boolean => {
  return !!item.riskLevel && item.riskLevel !== "normal";
};

/** 风险标记的悬浮提示文案 */
const riskTitle = (item: Contact | Group): string => {
  const label = RISK_LEVEL_LABELS[item.riskLevel || ""] || "存在风险";
  const count = item.riskReportCount || 0;
  return count > 0 ? `该群聊${label}（近 30 天 ${count} 次举报）` : `该群聊${label}`;
};

const friendCategories = reactive([
  { key: "robot", label: "机器人", expanded: false },
  { key: "myFriend", label: "我的好友", expanded: false },
]);

const groupCategories = reactive([
  { key: "topGroup", label: "置顶群聊", expanded: false },
  { key: "unnamedGroup", label: "未命名的群聊", expanded: false },
  { key: "createdGroup", label: "我创建的群聊", expanded: false },
  { key: "managedGroup", label: "我管理的群聊", expanded: false },
  { key: "joinedGroup", label: "我加入的群聊", expanded: false },
]);

const toggleFriendCategory = (key: string) => {
  const category = friendCategories.find((c) => c.key === key);
  if (category) category.expanded = !category.expanded;
};

const toggleGroupCategory = (key: string) => {
  const category = groupCategories.find((c) => c.key === key);
  if (category) category.expanded = !category.expanded;
};

const getFriendsByCategory = (categoryKey: string): Friend[] => {
  if (!props.friends) return [];
  return props.friends.filter((friend) => {
    if (categoryKey === "myFriend") {
      return !friend.category || friend.category === "myFriend";
    }
    return friend.category === categoryKey;
  });
};

const getGroupsByCategory = (categoryKey: string): Group[] => {
  if (!props.groups) return [];
  return props.groups.filter((group) => {
    switch (categoryKey) {
      case "topGroup":
        return !!group.isTop;
      case "unnamedGroup":
        return !group.name;
      case "createdGroup":
        return group.role === "owner";
      case "managedGroup":
        return group.role === "admin";
      case "joinedGroup":
        return group.role === "member";
      default:
        return false;
    }
  });
};

const getFriendCountByCategory = (categoryKey: string): number => {
  return getFriendsByCategory(categoryKey).length;
};

const getGroupCountByCategory = (categoryKey: string): number => {
  return getGroupsByCategory(categoryKey).length;
};

const showFriendCategories = computed(() => !props.searchQuery);
const showGroupCategories = computed(() => !props.searchQuery);

/**
 * 取联系人用于排序的真实时间戳。
 * lastMessageTime 是「今天 HH:mm / 昨天 HH:mm / M-D HH:mm」这类中文展示串，
 * 用 localeCompare 字典序排序会错（如「昨天」会排在「今天」前面），
 * 因此改用可解析的 lastMessageAt（后端 createdAt ISO 时间）排序。
 * 缺失 / 不可解析时回退 0（排到最后，保持稳定）。
 */
const getContactSortTime = (contact: Contact): number => {
  const at = contact.lastMessageAt;
  if (at) {
    const t = new Date(at).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
};

const filteredContacts = computed(() => {
  const list = props.contacts || [];

  if (!props.searchQuery) {
    return [...list].sort((a, b) => {
      // 「当前用户自己」始终排在最前
      const aIsSelf = a.isSelf ? 1 : 0;
      const bIsSelf = b.isSelf ? 1 : 0;
      if (aIsSelf !== bIsSelf) return bIsSelf - aIsSelf;
      const aIsTop = a.isTop ? 1 : 0;
      const bIsTop = b.isTop ? 1 : 0;
      if (aIsTop !== bIsTop) return bIsTop - aIsTop;
      return getContactSortTime(b) - getContactSortTime(a);
    });
  }

  const lowerQuery = props.searchQuery?.toLowerCase() || "";
  const selfContacts: Contact[] = [];
  const topContacts: Contact[] = [];
  const normalContacts: Contact[] = [];

  for (const contact of list) {
    const isTop = contact.isTop ?? false;

    const nameMatch = contact.name.toLowerCase().includes(lowerQuery);
    const remarkMatch = contact.remark ? contact.remark.toLowerCase().includes(lowerQuery) : false;
    const messageMatch = contact.lastMessage
      ? contact.lastMessage.toLowerCase().includes(lowerQuery)
      : false;
    const groupNumberMatch = contact.isGroup
      ? contact.groupNumber?.includes(props.searchQuery)
      : false;

    if (!nameMatch && !remarkMatch && !messageMatch && !groupNumberMatch) continue;

    if (contact.isSelf) {
      selfContacts.push(contact);
    } else if (isTop) {
      topContacts.push(contact);
    } else {
      normalContacts.push(contact);
    }
  }

  topContacts.sort((a, b) => getContactSortTime(b) - getContactSortTime(a));
  normalContacts.sort((a, b) => getContactSortTime(b) - getContactSortTime(a));

  // 「当前用户自己」始终排在最前
  return [...selfContacts, ...topContacts, ...normalContacts];
});

const filteredFriends = computed(() => {
  if (!props.friends || props.friends.length === 0) return [];
  if (!props.searchQuery) return props.friends;

  const lowerQuery = props.searchQuery.toLowerCase();
  return props.friends.filter(
    (friend) =>
      friend.name.toLowerCase().includes(lowerQuery) ||
      (friend.remark && friend.remark.toLowerCase().includes(lowerQuery)),
  );
});

const filteredGroups = computed(() => {
  if (!props.groups || props.groups.length === 0) return [];
  if (!props.searchQuery) return props.groups;

  const query = props.searchQuery;
  return props.groups.filter(
    (group) =>
      group.name.toLowerCase().includes(query.toLowerCase()) || group.groupNumber?.includes(query),
  );
});

const showNoContentTip = computed(() => {
  return props.contentType === "message"
    ? filteredContacts.value.length === 0
    : props.contentType === "friend"
      ? filteredFriends.value.length === 0
      : filteredGroups.value.length === 0;
});

const friendUnreadCount = computed(() => {
  return (props.friends || []).reduce((total: number, friend: any) => {
    return total + (friend.unreadCount || 0);
  }, 0);
});

const groupUnreadCount = computed(() => {
  return (props.groups || []).reduce((total: number, group: any) => {
    return total + (group.unreadCount || 0);
  }, 0);
});

const handleContactClick = async (contactId: string) => {
  emit("closeDrawer");
  emit("contactSelect", contactId);
};

const handleNoticeClick = (type: "friend" | "group") => {
  if (type === "friend") {
    emit("friendNoticeClick");
  } else {
    emit("groupNoticeClick");
  }
};
</script>

<style lang="scss" scoped>
/* ================================================================
   1. 全局 token
   ================================================================ */
.content-container {
  --radius-xs: 4px;
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-full: 999px;

  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;

  flex: 1;
  overflow-y: auto;
  min-height: 200px;
  display: flex;
  flex-direction: column;

  /* 主色必须带动态主题分支：这是 inline v-bind 变量，CSS 里再写覆盖盖不过它。
     之前只取调色板色（个性装扮复用日间配色，接近白），导致动态主题下
     选中竖条 / Tab 选中色「跟普通主题一样」，完全没有壁纸吸色。 */
  --primary-color: v-bind("siderColorStore.hasDynamicBackground ? siderColorStore.dynamicAccent : siderColorStore.currentColor");
  --bg-hover: v-bind("siderColorStore.contactItemHoverBg");
  --bg-active: v-bind("siderColorStore.contactItemActiveBg");
  --bg-primary: v-bind("siderColorStore.currentColorPalette.bgPrimary || '#ffffff'");
  --danger-color: v-bind("siderColorStore.currentColorPalette.dangerColor || '#f5222d'");
  --success-color: v-bind("siderColorStore.currentColorPalette.successColor || '#52c41a'");
  --text-primary: v-bind("siderColorStore.currentColorPalette.textPrimary");
  --text-secondary: v-bind("siderColorStore.currentColorPalette.textSecondary");
  --divider-color: v-bind("siderColorStore.panelDividerColor");
  border-right: 1px solid v-bind("siderColorStore.panelDividerColor");

  &.has-dynamic-bg {
    background: var(--dt-overlay, transparent);
    /* --primary-color 不在这里覆盖：它是 inline v-bind 变量，这里写了也盖不过，
       动态主题的吸色分支已经写在上面 .content-container 的 --primary-color 里 */
    --divider-color: rgba(255, 255, 255, 0.22);

    .contact-name,
    .contact-time,
    .message-text,
    .notice-text,
    .collapse-title,
    .collapse-count,
    .tab-item,
    .empty-text {
      color: var(--dt-text);
      text-shadow: var(--dt-text-shadow);
    }

    .message-text,
    .collapse-count,
    .contact-time {
      color: rgba(255, 255, 255, 0.85);
    }

    .contact-name .group-meta {
      color: rgba(255, 255, 255, 0.8);
      text-shadow:
        0 1px 3px rgba(0, 0, 0, 0.75),
        0 0 8px rgba(0, 0, 0, 0.5);
    }

    .collapse-arrow {
      color: rgba(255, 255, 255, 0.85);
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
    }

    .notice-arrow {
      color: rgba(255, 255, 255, 0.65);
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6));
    }

    .meta-text.online-status {
      color: var(--success-color);
      background: rgba(74, 222, 128, 0.18);
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
    }

    .tab-item.active {
      color: #fff;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.6);
    }

    .badge {
      border-color: rgba(0, 0, 0, 0.55) !important;
    }

    .badge-unread {
      box-shadow: 0 0 0 2px rgba(0, 0, 0, 0.45);
    }

    /* 置顶 / 免打扰图标：动态壁纸下必须用白字 + 投影才看得清。
       ⚠️ 这里不能只写 .meta-icon —— 后面「第二行：最后消息 + 置顶/免打扰/风险图标」
       里定义的是 .contact-bottom-row .contact-tags .meta-icon（4 个 class），
       论特异性会把这里（3 个 class）压回去，于是图标又变回吸色主色、在壁纸上糊成一片。
       所以这里补齐选择器层级 + !important；风险图标保持橙色，用 :not(.risk-icon) 排除。 */
    .contact-bottom-row .contact-tags .meta-icon:not(.risk-icon) {
      color: #fff !important;
      opacity: 0.95 !important;
      filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.85)) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.6)) !important;
    }

    .tab-bar {
      background: rgba(255, 255, 255, 0.08);

      .tab-item {
        &:hover {
          background: rgba(255, 255, 255, 0.1);
        }
        &.active {
          background: var(--primary-color);
          color: #fff;
        }
      }
    }

    .collapse-header {
      &::before {
        background: rgba(255, 255, 255, 0.6);
      }
      &:hover::before,
      &.expanded::before {
        background: var(--primary-color);
      }
    }

    .collapse-count {
      color: rgba(255, 255, 255, 0.8);
    }

    .empty-illustration {
      color: rgba(255, 255, 255, 0.4);
    }

    .empty-category-inline,
    .empty-category,
    .empty-state {
      .empty-text {
        color: rgba(255, 255, 255, 0.7);
      }
    }
  }
}

/* ================================================================
   2. 通用卡片
   ================================================================ */
.contact-card {
  --avatar-size: 46px;
  --avatar-radius: 50%;

  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: 10px var(--space-3);
  margin: 3px var(--space-2);
  min-height: 66px;
  box-sizing: border-box;
  border-radius: var(--radius-md);
  cursor: pointer;
  position: relative;
  background: transparent;

  &:hover {
    background: var(--bg-hover);
  }

  &.active {
    background: var(--bg-active);

    &::before {
      content: "";
      position: absolute;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
      width: 3px;
      height: 22px;
      border-radius: 0 3px 3px 0;
      background: var(--primary-color);
    }
  }

  &.is-top:not(.active) {
    background: var(--bg-hover);
  }

  &.is-muted {
    .contact-name,
    .message-text {
      opacity: 0.6;
    }
  }

  .contact-avatar-container {
    position: relative;
    flex-shrink: 0;
    width: var(--avatar-size);
    height: var(--avatar-size);

    .avatar-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
    }

    .badge {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2;
    }

    .badge-unread {
      top: -4px;
      right: -4px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      font-size: 10px;
      font-weight: 600;
      color: #fff;
      background: var(--danger-color);
      border-radius: var(--radius-full);
      line-height: 1;
      box-shadow: 0 0 0 2px var(--bg-primary);
    }

    .badge-online {
      bottom: 1px;
      right: 1px;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--text-secondary);
      border: 2px solid var(--bg-primary);

      &.online {
        background: var(--success-color);
      }
    }
  }

  .contact-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    line-height: 1.3;
    padding-top: 1px;
  }

  /* 第一行：名称 + 时间 */
  .contact-top-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    min-width: 0;

    .contact-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;

      .group-meta {
        font-size: 11px;
        font-weight: 400;
        color: var(--text-secondary);
        margin-left: 4px;
      }
    }

    .contact-time {
      flex-shrink: 0;
      font-size: 11px;
      color: var(--text-secondary);
      opacity: 0.85;
    }

    .meta-text {
      flex-shrink: 0;
      font-size: 11px;
      line-height: 1;
      padding: 2px 6px;
      border-radius: var(--radius-xs);
      color: var(--success-color);
      background: color-mix(in srgb, var(--success-color) 12%, transparent);
    }

    .meta-icon {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      font-size: 12px;
      color: var(--primary-color);
      opacity: 0.75;

      &.risk-icon {
        color: var(--warning-color, #f59e0b);
        opacity: 1;
        filter: drop-shadow(0 0 2px rgba(245, 158, 11, 0.35));
      }
    }
  }

  /* 第二行：最后消息 + 置顶/免打扰/风险图标（常显） */
  .contact-bottom-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-2);
    min-width: 0;

    .message-text {
      flex: 1;
      min-width: 0;
      font-size: 12.5px;
      color: var(--text-secondary);
      margin: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .contact-tags {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 4px;
      /* 常显：不做 hover 隐藏 */
      opacity: 1;
      pointer-events: auto;

      .meta-icon {
        display: inline-flex;
        align-items: center;
        font-size: 12px;
        color: var(--primary-color);
        opacity: 0.75;

        &.risk-icon {
          color: var(--warning-color, #f59e0b);
          opacity: 1;
          filter: drop-shadow(0 0 2px rgba(245, 158, 11, 0.35));
        }
      }
    }
  }
}

.group-card {
  --avatar-radius: 30%;
}

/* ================================================================
   3. 消息列表
   ================================================================ */
.contact-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-top: var(--space-2);

  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 20px;
    min-height: 300px;
    gap: var(--space-3);

    .empty-illustration {
      color: var(--text-secondary);
      opacity: 0.4;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .empty-text {
      font-size: 13px;
      color: var(--text-secondary);
      margin: 0;
      letter-spacing: 0.3px;
      opacity: 0.85;
    }
  }
}

/* ================================================================
   3.1 夜间选中 / 悬浮态（消息列表 + 好友/群聊列表通用）
   ================================================================ */
/* 夜间：调色板派生的悬浮 / 选中色都是半透明灰蓝，在深底上发灰，统一改用中性暗色。
   列表底色是 --bg-primary（#0a0a0a）：悬浮 #161616（淡，只轻轻托一下）、
   选中 #1a1a1a（比悬浮亮一档，看得清当前项，又压得住不刺眼）。
   注意：完整选择器必须整个写进 :global()，`:global(html.dark) .foo`
   会被 Vue 编译成 `html.dark {}` 并丢掉后半段。 */
:global(html.dark .contact-card:hover:not(.active)),
:global(html.dark .contact-item:hover:not(.active)),
:global(html.dark .contact-card.is-top:not(.active)),
:global(html.dark .contact-item.is-top:not(.active)) {
  background: #161616;
}

:global(html.dark .contact-card.active),
:global(html.dark .contact-item.active) {
  background: #1a1a1a;
}

/* ================================================================
   4. 好友 / 群聊面板
   ================================================================ */
.relationship-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;

  .notice-list {
    display: flex;
    flex-direction: column;
    margin: var(--space-1) 10px 0;
    flex-shrink: 0;

    .notice-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      height: 36px;
      padding: 0 10px;
      cursor: pointer;
      background: transparent;
      border-radius: var(--radius-sm);

      & + .notice-item {
        border-top: 1px solid var(--divider-color);
      }

      &:hover {
        background: var(--bg-hover);
      }

      .notice-text {
        font-size: 13px;
        font-weight: 500;
        color: var(--text-primary);
        opacity: 0.85;
      }

      .notice-arrow {
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        color: var(--text-secondary);
        opacity: 0.5;

        .iconfont {
          font-size: 14px;
        }
      }

      &:hover .notice-arrow {
        opacity: 0.9;
      }
    }
  }

  .tab-bar {
    display: flex;
    gap: var(--space-1);
    margin: 6px var(--space-3);
    padding: 3px;
    background: var(--bg-hover);
    border-radius: var(--radius-md);
    flex-shrink: 0;
    overflow: hidden;

    .tab-item {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 30px;
      font-size: 13px;
      color: var(--text-secondary);
      cursor: pointer;
      border-radius: var(--radius-sm);
      user-select: none;
      position: relative;

      &:hover {
        color: var(--text-primary);
      }

      &.active {
        background: var(--primary-color);
        color: #fff;
        font-weight: 500;
      }

      .tab-badge {
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        background: var(--danger-color);
        color: #fff;
        border-radius: var(--radius-full);
        font-size: 10px;
        font-weight: 500;
        display: flex;
        align-items: center;
        justify-content: center;
        line-height: 1;
      }
    }
  }

  /* 夜间兜底：本组件顶部的 --bg-hover / --primary-color / --text-* 都是
     侧边栏调色板经 v-bind 注入的 inline style，CSS 变量覆盖不到，
     tab 栏因此会一直沿用日间取值。这里用 html.dark 提高权重显式回落。
     注意：完整选择器必须整个写进 :global()，`:global(html.dark) &` 会被
     Vue 编译成 `html.dark {}` 并丢掉后半段，规则等于不存在。 */
  :global(html.dark .relationship-panel .tab-bar) {
    background: var(--bg-tertiary);
    border: 1px solid var(--border-color);
  }

  :global(html.dark .relationship-panel .tab-item) {
    color: #9ca3af;
  }

  :global(html.dark .relationship-panel .tab-item:hover) {
    color: #e8e8e8;
  }

  :global(html.dark .relationship-panel .tab-item.active) {
    background: var(--bg-secondary);
    color: #e8e8e8;
  }

  .tab-content {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;

    .list-panel {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      padding: var(--space-1) 0 var(--space-2);
    }
  }

  .category-collapse {
    display: flex;
    flex-direction: column;
    padding: 0 var(--space-1);

    .collapse-group {
      margin-bottom: 2px;

      .collapse-header {
        display: flex;
        align-items: center;
        gap: var(--space-2);
        height: 34px;
        padding: 0 10px 0 6px;
        margin: 0 var(--space-1);
        border-radius: var(--radius-md);
        cursor: pointer;
        user-select: none;

        &::before {
          content: "";
          width: 3px;
          height: 14px;
          border-radius: 2px;
          background: var(--text-secondary);
          opacity: 0.45;
          flex-shrink: 0;
          transition:
            background 0.15s ease,
            height 0.15s ease,
            opacity 0.15s ease;
        }

        &:hover::before,
        &.expanded::before {
          background: var(--primary-color);
          opacity: 1;
          height: 18px;
        }

        &:hover {
          background: var(--bg-hover);
        }

        .collapse-arrow {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 12px;
          font-size: 12px;
          color: var(--text-secondary);
          flex-shrink: 0;

          &.expanded {
            transform: rotate(90deg);
          }

          .iconfont {
            font-size: 12px;
          }
        }

        .collapse-title {
          flex: 1;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .collapse-count {
          font-size: 11px;
          color: var(--text-secondary);
          opacity: 0.85;
          font-variant-numeric: tabular-nums;
          flex-shrink: 0;
          margin-left: var(--space-2);
        }
      }

      .collapse-body {
        padding-left: 6px;
      }
    }
  }

  .empty-category,
  .empty-category-inline {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .empty-text {
      font-size: 13px;
      color: var(--text-secondary);
      margin: 0;
      letter-spacing: 0.3px;
      opacity: 0.85;
    }
  }

  .empty-category {
    padding: 40px 20px;
  }

  .empty-category-inline {
    padding: 16px 20px;
    margin: 0 var(--space-2);
  }
}
</style>