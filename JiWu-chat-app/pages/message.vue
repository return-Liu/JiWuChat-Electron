<template>
  <div class="page-wrapper">
    <div class="qq-chat-container" :class="{ 'has-dynamic-bg': hasDynamicBackground }">
      <DynamicBackground />
      <div class="qq-main">
        <!-- 侧边栏导航 -->
        <Sidebar :current-area="'message'" />
        <div class="message-content">
          <div class="chat-main-area">
            <!-- 中间联系人/群聊列表区域（同步状态提示在其内部，搜索框与列表之间） -->
            <MiddleArea
              :content-type="'message'"
              :contacts="contacts"
              :active-contact-id="activeContactId"
              :pending-group-application-count="pendingGroupApplicationCount"
              :pending-friend-application-count="pendingFriendApplicationCount"
              :sync-state="syncState"
              no-content-tip="没有搜索到相关联系人/群聊"
              placeholder="搜索联系人/群聊"
              @contact-select="handleContactSelect"
              @group-created="handleGroupCreated"
              @update-contact="handleUpdateContact"
              @refresh-contacts="handleRefreshContacts"
              @refresh-group-application-count="loadPendingGroupApplicationCount"
              @refresh-friend-application-count="loadPendingFriendApplicationCount"
              @sync-retry="() => reloadContacts()"
              @close-drawer="closeContactDrawer"
            />
            <!-- 右侧聊天窗口区域 -->
            <RightChatArea
              ref="rightChatAreaRef"
              :contacts="contacts"
              :active-contact-id="activeContactId"
              :chat-loading="chatLoading"
              @send-message="handleSendMessageWrapper"
              @edit-remark="handleEditRemarkWrapper"
              @clear-chat="handleClearChatWrapper"
              @delete-friend="handleDeleteFriendWrapper"
              @delete-temporary-contact="handleDeleteTemporaryContactWrapper"
              @toggle-top="handleToggleTopWrapper"
              @toggle-mute="handleToggleMuteWrapper"
              @quit-group="handleQuitGroupWrapper"
              @dissolve-group="handleDissolveGroupWrapper"
              @update-group-rule="handleUpdateGroupRuleWrapper"
              @refresh-contacts="handleRefreshContacts"
              @contact-select="handleContactSelect"
              :current-user-id="currentUserId"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 自定义系统通知组件 -->
    <NotificationComponent ref="notificationComponentRef" />

    <!-- 状态栏通知组件 -->
    <StatusBarNotification ref="statusBarNotificationRef" />

    <!-- 版本更新提醒组件 -->
    <UpdateReminderModal
      :visible="showUpdateReminder"
      @update:visible="showUpdateReminder = $event"
      ref="updateReminderRef"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, onUnmounted, nextTick, watch } from "vue";
import { useRouter } from "vue-router";
import { useUserStore } from "../stores/user";
import { useSiderColor } from "../stores/siderColor";
import { useDynamicBackground } from "../composables/useDynamicBackground";
import request from "../untils/request";
import { websocketService } from "../untils/websocket";
import {
  handleUpdateGroupRule,
  handleToggleTop,
  handleToggleMute,
  handleSendMessage,
  handleEditRemark,
  getChatHistory,
  invalidateChatHistoryCache,
  markMessagesAsRead,
  getReadCursor,
} from "../untils/contactManager";
import { getTemporaryContacts } from "../untils/temporaryContactManager";
import {
  readContactsCache,
  saveContactsCache,
  pruneExpiredContactsCache,
} from "../untils/contactCache";
import {
  refreshGroups as refreshGroupsUtil,
  fetchFriendsList as fetchFriendsListUtil,
  fetchAllRecentMessages as fetchAllRecentMessagesUtil,
  handleRealtimeMessage as handleRealtimeMessageUtil,
  handleRecallMessage as handleRecallMessageUtil,
  handleDeleteMessageFromWs as handleDeleteMessageFromWsUtil,
  handleBatchDeleteMessagesFromWs as handleBatchDeleteMessagesFromWsUtil,
  handleGroupMemberLevelUpdate as handleGroupMemberLevelUpdateUtil,
  handleGroupMemberTitleUpdate as handleGroupMemberTitleUpdateUtil,
  restoreContactStates as restoreContactStatesUtil,
  prepareTemporaryChat,
  createSelfContact as createSelfContactUtil,
  extractJoinMessages as extractJoinMessagesUtil,
  MessageLoader,
  type MessagePageState,
} from "../untils/messageManager";
import type { Contact } from "../types/chatTypes";
import { message } from "ant-design-vue";
import { useCallStore } from "../stores/call";
import {
  createCallMessage,
  insertCallMessageToContact,
  sendCallRecordToServer,
} from "../untils/callMessageUtils";

// 加载状态
const loading = ref<boolean>(false);
const chatLoading = ref<boolean>(false);

// 核心数据
const router = useRouter();
const userStore = useUserStore();
const siderColorStore = useSiderColor();

// 个性装扮：动态背景渲染见 <DynamicBackground />；
// 取色与状态统一走 useDynamicBackground（全局单例，避免页面与组件各取一次色）
const { hasDynamicBackground } = useDynamicBackground();

const activeContactId = ref<string>("");
const contacts = ref<Contact[]>([]);
const currentUserId = ref<string>("");
const rightChatAreaRef = ref();

// 通知组件引用
const notificationComponentRef = ref();
const statusBarNotificationRef = ref();

// 待处理群聊申请数量
const pendingGroupApplicationCount = ref(0);

// 待处理好友申请数量
const pendingFriendApplicationCount = ref(0);

// 版本更新提醒
const showUpdateReminder = ref(false);
const updateReminderRef = ref();

// MessageLoader 实例
let messageLoader: MessageLoader | null = null;

// 消息页面状态对象
const messageState: MessagePageState = {
  get contacts() {
    return contacts.value;
  },
  set contacts(v) {
    contacts.value = v;
  },
  get activeContactId() {
    return activeContactId.value;
  },
  set activeContactId(v) {
    activeContactId.value = v;
  },
  get currentUserId() {
    return currentUserId.value;
  },
  set currentUserId(v) {
    currentUserId.value = v;
  },
};

// 去重工具函数：合并联系人并去重
const mergeAndDeduplicateContacts = (
  existingContacts: Contact[],
  newContacts: Contact[],
): Contact[] => {
  const contactMap = new Map<string, Contact>();

  existingContacts.forEach((contact) => {
    const id = String(contact.id);
    contactMap.set(id, contact);
  });

  newContacts.forEach((contact) => {
    const id = String(contact.id);
    if (!contactMap.has(id)) {
      contactMap.set(id, contact);
    }
  });

  return Array.from(contactMap.values());
};

// 过滤临时会话：移除已经是好友的临时会话
const filterTemporaryContacts = (tempContacts: Contact[], friendIds: Set<string>): Contact[] => {
  return tempContacts.filter((tempContact) => {
    const tempId = String(tempContact.id);
    if (friendIds.has(tempId)) {
      return false;
    }
    return true;
  });
};

/**
 * 刷新时保留的「运行时字段」：这些字段由本地会话状态维护（历史消息、分页游标、群成员等），
 * 后端返回的联系人元数据里没有（或为空），整体替换数组会把它们冲掉，
 * 表现为「同步完成后聊天记录消失」。
 */
const RUNTIME_CONTACT_FIELDS = [
  "messages",
  "chatHistoryPagination",
  "groupMembers",
  "joinMessages",
  "joinNotices",
  "lastMessageSender",
  "myGroupNickname",
] as const;

/**
 * 原地合并联系人元数据。
 *
 * 关键点：**复用 existing 的对象引用**，只把 incoming 的元数据字段覆盖上去，
 * 保留 existing 上的运行时字段（messages / 分页 / 群成员等）。
 *
 * 为什么不能直接 `contacts.value = newList`：
 *   1) newList 里的 contact 都是新对象，messages 为 []，会冲掉已加载的聊天记录；
 *   2) 当前活跃会话的 contact 引用被换掉后，正在进行的 getChatHistory 写回的是旧对象，
 *      界面会显示空列表（表现为"同步中/已是最新时聊天记录被刷掉"）；
 *   3) MessageLoader 内部持有的 contacts 引用也会与页面不一致，实时消息写错对象。
 *
 * @param existing 当前页面正在使用的联系人数组（对象引用会被复用）
 * @param incoming 刷新得到的最新联系人数组
 * @returns 与 existing 元素引用保持一致的合并结果
 */
const mergeContactMetadata = (existing: Contact[], incoming: Contact[]): Contact[] => {
  const existingMap = new Map<string, Contact>();
  existing.forEach((contact) => existingMap.set(String(contact.id), contact));

  return incoming.map((fresh) => {
    const current = existingMap.get(String(fresh.id));
    // 新出现的联系人（如刚加的群/好友）：直接使用新对象
    if (!current) return fresh;

    // 复用旧对象：先铺开旧数据，再用新元数据覆盖，最后把运行时字段还原回来
    const merged: Contact = { ...current, ...fresh };

    RUNTIME_CONTACT_FIELDS.forEach((field) => {
      const currentValue = (current as any)[field];
      // 仅当旧值有内容时才保留，避免把「本来就是空」的字段也强行还原
      if (currentValue !== undefined && currentValue !== null) {
        (merged as any)[field] = currentValue;
      }
    });

    return merged;
  });
};

// 新建群 / 邀请好友入群后刷新列表
const handleGroupCreated = async () => {
  loading.value = true;
  try {
    // 必须走完整刷新（含最近消息）：只刷群列表不会拉取 lastMessage，
    // 新群就会一直显示"没有消息"，必须手动刷新才出现。
    await handleRefreshContacts();

    if (contacts.value.length && !activeContactId.value) {
      activeContactId.value = String(contacts.value[contacts.value.length - 1].id);
    }
  } finally {
    loading.value = false;
  }
};

// 优化：并行加载所有联系人数据
// @param loadHistory 是否同时预加载各群聊的历史消息。
//   统一传 false：群历史改为「打开某群时按需拉取」（handleContactSelect / ensureActiveContactLoaded），
//   避免群聊数量多时进入页面就逐个群拉历史导致首屏变慢。
const loadAllContactsParallel = async (userStore: any, loadHistory = false) => {
  const selfContact = createSelfContactUtil(currentUserId.value);

  const [friends, groups, tempContacts] = await Promise.all([
    fetchFriendsListUtil().catch(() => []),
    refreshGroupsUtil([selfContact], currentUserId.value, {
      fetchRecentMessages: false,
      loadHistory,
    }).catch(() => [selfContact]),
    getTemporaryContacts().catch(() => []),
  ]);

  const friendIds = new Set<string>();
  friends.forEach((friend) => {
    friendIds.add(String(friend.id));
  });

  let allContacts = [selfContact, ...friends];

  const groupContacts = groups.filter((contact) => contact.isGroup);
  allContacts = [...allContacts, ...groupContacts];

  if (tempContacts.length > 0) {
    const filteredTempContacts = filterTemporaryContacts(tempContacts, friendIds);

    if (filteredTempContacts.length > 0) {
      allContacts = mergeAndDeduplicateContacts(allContacts, filteredTempContacts);
    }
  }

  return allContacts;
};

/**
 * 进入消息页的完整数据加载（唯一入口）。
 *
 * 一次性拉齐：自己 + 好友 + 群聊（不含群历史）+ 临时会话 + 最近消息摘要。
 * 群历史改为「打开某群时按需拉取」（handleContactSelect / ensureActiveContactLoaded），
 * 避免群聊数量多时进入页面就逐个群拉历史导致首屏变慢。
 *
 * @param forceRefresh 是否绕过 /message/latest 的短时缓存（切回页面时传 true 拿最新）
 * @returns 完整联系人列表
 */
const loadAllContactsOnce = async (forceRefresh = false): Promise<Contact[]> => {
  const allContacts = await loadAllContactsParallel(userStore, false);
  restoreContactStatesUtil(allContacts, currentUserId.value);
  await fetchAllRecentMessagesUtil(allContacts, currentUserId.value, { forceRefresh });
  return allContacts;
};

// 联系人刷新序号：并发刷新时只保留最后一次的结果，避免旧结果覆盖新数据
let contactsRefreshSeq = 0;

// 会话加载序号：并发加载同一/不同会话时，只让最新一次负责复位 chatLoading，
// 避免「旧请求先结束 → loading 提前变 false → 加载提示闪一下就消失」。
let sessionLoadSeq = 0;

/**
 * 缓存同步节流：消息到达 / 已读 / 局部更新都会改变 contacts，
 * 这里合并写回，保证缓存始终是最新数据，下次进入页面无需重新请求。
 */
const CACHE_SYNC_DELAY = 2000;

/**
 * 顶部同步状态：由父组件驱动，子组件纯展示。
 * 取值：
 *   idle    不显示
 *   syncing 正在同步中…
 *   synced  已是最新（短暂展示后自动回到 idle）
 *   failed  同步失败
 */
const syncState = ref<"idle" | "syncing" | "synced" | "failed">("idle");

let syncHideTimer: ReturnType<typeof setTimeout> | null = null;
let syncingMinTimer: ReturnType<typeof setTimeout> | null = null;

/** syncing 状态的最短展示时长，保证用户能感知到"正在同步" */
const SYNCING_MIN_DURATION = 400;
/** synced 状态的展示时长 */
const SYNCED_DISPLAY_DURATION = 1500;

/** 记录进入 syncing 的时间，用于计算最短展示时长 */
let syncingStartedAt = 0;
/** 延迟切换的目标状态：syncing 最短时长未到时暂存于此 */
let pendingTargetState: "idle" | "synced" | "failed" | null = null;

const clearSyncTimers = () => {
  if (syncHideTimer) {
    clearTimeout(syncHideTimer);
    syncHideTimer = null;
  }
  if (syncingMinTimer) {
    clearTimeout(syncingMinTimer);
    syncingMinTimer = null;
  }
};

/**
 * 设置同步状态。
 * - 状态未变化：不重复处理，避免误清定时器
 * - 从 syncing 转其他状态：若 syncing 展示时长不足 SYNCING_MIN_DURATION，
 *   延迟到满足最短时长后再切换，保证「正在同步中…」能被看到
 */
const setSyncState = (state: "idle" | "syncing" | "synced" | "failed") => {
  // 状态相同：补足缺失的定时器，不重置
  if (syncState.value === state) {
    if (state === "synced" && !syncHideTimer) {
      syncHideTimer = setTimeout(() => {
        syncHideTimer = null;
        setSyncState("idle");
      }, SYNCED_DISPLAY_DURATION);
    }
    return;
  }

  // 从 syncing 切走：若展示时长不足，延迟切换
  if (syncState.value === "syncing" && state !== "syncing") {
    const elapsed = Date.now() - syncingStartedAt;
    if (elapsed < SYNCING_MIN_DURATION) {
      // 记录目标状态，等最短时长满足后切换
      pendingTargetState = state;
      if (syncingMinTimer) clearTimeout(syncingMinTimer);
      syncingMinTimer = setTimeout(() => {
        syncingMinTimer = null;
        const target = pendingTargetState;
        pendingTargetState = null;
        if (target) setSyncState(target);
      }, SYNCING_MIN_DURATION - elapsed);
      return;
    }
  }

  // 若正在等待切换，取消
  if (pendingTargetState) {
    pendingTargetState = null;
    if (syncingMinTimer) {
      clearTimeout(syncingMinTimer);
      syncingMinTimer = null;
    }
  }

  // 状态切换：清理旧定时器
  clearSyncTimers();

  syncState.value = state;

  if (state === "syncing") {
    syncingStartedAt = Date.now();
  }

  // 已同步：短暂展示后自动隐藏
  if (state === "synced") {
    syncHideTimer = setTimeout(() => {
      syncHideTimer = null;
      setSyncState("idle");
    }, SYNCED_DISPLAY_DURATION);
  }
};

let cacheSyncTimer: ReturnType<typeof setTimeout> | null = null;
const scheduleCacheSync = () => {
  if (cacheSyncTimer) return;
  cacheSyncTimer = setTimeout(() => {
    cacheSyncTimer = null;
    saveContactsCache(currentUserId.value, contacts.value);
  }, CACHE_SYNC_DELAY);
};

/**
 * 重新拉取完整联系人数据并更新界面（唯一刷新入口）。
 *
 * 统一了原先 refreshContactsSilently / syncLatestMessages / startSync 三套重复逻辑：
 * 无论「进页面同步」「手动重试」还是「后台刷新」，都走同一条路径——
 * 拉齐完整数据 → 原地合并（保留聊天记录）→ 写缓存 → 同步 MessageLoader。
 *
 * @param silent 为 true 时不显示顶部提示（用于后台自动刷新）
 * @returns 是否成功
 */
const reloadContacts = async (silent = false, forceRefresh = false): Promise<boolean> => {
  const seq = ++contactsRefreshSeq;
  if (!silent) setSyncState("syncing");

  try {
    const allContacts = await loadAllContactsOnce(forceRefresh);

    // 期间若已有更新的刷新，丢弃本次结果（返回 true 避免误判为失败）
    if (seq !== contactsRefreshSeq) return true;

    // 原地合并：复用现有 contact 对象引用，保留 messages / 分页 / 群成员等运行时字段
    const merged = mergeContactMetadata(contacts.value, allContacts);
    restoreContactStatesUtil(merged, currentUserId.value);

    contacts.value = merged;
    saveContactsCache(currentUserId.value, merged);
    // 必须传 contacts.value（响应式），传原始 merged 会让 MessageLoader 变成非响应式写入
    messageLoader?.setContacts(contacts.value);

    if (!silent) setSyncState("synced");
    return true;
  } catch (error) {
    console.warn("[联系人] 刷新失败:", error);
    if (!silent) setSyncState("failed");
    return false;
  }
};

/**
 * 原地同步联系人数组（实时消息 / MessageLoader 更新回调专用）。
 *
 * 为什么不用 `contacts.value = updatedContacts`：
 *   整体替换数组会让 Vue 认为整个列表是新的，触发全量重渲染；
 *   更严重的是，当前活跃会话的 contact 对象若被换成新对象，
 *   正在展示的 messages 会被清空（表现为「聊天记录被刷掉」）。
 *
 * 这里改为：**复用现有 contact 对象引用**，只把变化的部分合并进去，
 * 并保持 contacts 数组容器不变（用 splice 原地更新），
 * 这样既能让界面刷新，又不会丢失已加载的聊天记录。
 *
 * @param incoming MessageLoader 传回的最新联系人数组
 */
const syncContactsInPlace = (incoming: Contact[]) => {
  const current = contacts.value;
  const currentMap = new Map<string, Contact>();
  current.forEach((c) => currentMap.set(String(c.id), c));

  // 逐个合并：已有联系人复用旧对象（保留 messages 等运行时字段），新联系人直接加入
  const merged = incoming.map((fresh) => {
    const existing = currentMap.get(String(fresh.id));
    if (!existing) return fresh;
    // 复用旧对象引用，覆盖元数据；messages 等由 MessageLoader 内部维护，此处已是同一引用
    return Object.assign(existing, fresh);
  });

  // 原地更新数组：保持 contacts.value 的数组引用不变，避免整表重渲染
  current.splice(0, current.length, ...merged);

  // 🔥 兜底：让 MessageLoader 内部数组始终指向「同一个响应式数组」。
  // 否则它的原地写入（push / 索引赋值）不会触发 Vue 更新，
  // 表现就是实时消息（含机器人自动回复）要切换会话或页面才出现。
  messageLoader?.setContactsReference(current);
};

// 初始化 MessageLoader（纯 WebSocket 驱动，无需轮询）
const initializeMessageLoader = () => {
  if (messageLoader) {
    messageLoader.destroy();
  }

  messageLoader = new MessageLoader(contacts.value, currentUserId.value);

  // 设置通知相关参数
  messageLoader.setNotificationOptions({
    notificationComponentRef,
    statusBarNotificationRef,
    router,
    activeContactId,
  });

  // 注册更新回调 - 当消息更新时自动刷新界面
  //
  // ⚠️ 这里不触发顶部「同步中」提示：
  //   实时消息（对方发来 / 自己发送回执）属于高频事件，逐条弹提示会频繁闪烁，
  //   且用户并不需要「每条消息都被告知正在同步」。顶部提示只保留给「进页面同步」。
  //
  // 数据更新采用「原地替换元素引用 + 复用数组」：
  //   - MessageLoader 内部持有同一个 contacts 数组引用，原地 splice 能让两边保持一致；
  //   - 不整体替换数组，避免当前会话的消息列表在重渲染中被清空（表现为「聊天记录被刷掉」）。
  messageLoader.onUpdate((updatedContacts) => {
    syncContactsInPlace(updatedContacts);
  });
};

// 页面初始化
onMounted(async () => {
  try {
    // 主动清理已过期 / 损坏的联系人缓存，释放 localStorage 配额（同步、极快）
    pruneExpiredContactsCache();

    // initializeAuth 内部已有缓存判断，如果 login 时已 fetchUserInfo 则直接复用
    await userStore.initializeAuth();
    // 仅在 initializeAuth 没有拉到用户信息时才显式拉取
    if (!userStore.user) {
      await userStore.fetchUserInfo();
    }
    currentUserId.value = String(userStore.user?.id || "current-user");

    // 请求系统通知权限
    const notificationType = localStorage.getItem("notificationType") as "native" | "desktop";
    const notificationEnabled = localStorage.getItem("notificationEnabled") !== "false";

    if (notificationEnabled && notificationType === "native" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }

    // 提前注册好友在线状态监听（在联系人加载之前，避免丢失事件）
    websocketService.on("friend_status_changed", handleFriendStatusChanged);

    // 初始化信令监听器（通话功能）
    initializeSignalingListener();

    // ============================================================
    // 进入消息页：一次性加载所有联系人与聊天记录（无分级、无优先级）
    // ============================================================

    // 1) WebSocket 连接（提前到数据加载之前）
    //    ⚠️ 必须优先建立连接与消息监听，否则「切走再切回」时：
    //       onUnmounted 已移除上一实例的全部监听，而新实例的监听若等到
    //       ensureActiveContactLoaded（含 getChatHistory 网络请求）之后才注册，
    //       中间会有一段「监听真空期」，期间的实时消息会全部丢失，
    //       表现为「切回页面后新消息不同步」。
    if (!websocketService.isConnected()) {
      websocketService.connect().catch(() => {
        message.warning("实时消息服务连接失败，将自动重试");
      });
    }

    // 2) 先读本地缓存秒开列表（有则先渲染，避免白屏）
    const cachedContacts = readContactsCache(currentUserId.value);
    // 有缓存说明是「切回 / 刷新」而非首次进入，后续需强制刷新拿最新数据
    const hasCache = cachedContacts.length > 0;
    if (hasCache) {
      restoreContactStatesUtil(cachedContacts, currentUserId.value);
      contacts.value = cachedContacts;
      // 列表已可交互，结束整页 loading（完整数据在下面继续拉取）
      loading.value = false;
    }

    // 3) 注册联系人到通话 Store + 初始化 MessageLoader（基于缓存/空列表提前建立）
    const callStore = useCallStore();
    callStore.registerContacts(() => contacts.value);
    initializeMessageLoader();

    // 4) 注册 WebSocket 消息监听（提前到数据加载之前，此时 messageLoader 已就绪）
    initializeWebSocketMessageListener();

    // 5) 一次性拉齐完整数据（自己 + 好友 + 群聊 + 临时会话 + 最近消息摘要）
    //    - 首次进入（无缓存）：显示整页 loading + 顶部「同步中」
    //    - 切回/刷新（有缓存）：已由缓存秒开渲染，静默刷新，不遮罩、不闪「同步中」；
    //      但仍传 forceRefresh=true 绕过 /message/latest 短时缓存，保证拿到最新。
    if (!hasCache) {
      loading.value = true;
      setSyncState("syncing");
    }

    try {
      const allContacts = await loadAllContactsOnce(hasCache);

      // 原地合并：复用缓存中已存在的 contact 对象引用，保留运行时字段
      const merged = mergeContactMetadata(contacts.value, allContacts);
      restoreContactStatesUtil(merged, currentUserId.value);

      contacts.value = merged;
      saveContactsCache(currentUserId.value, merged);
      // MessageLoader 提前创建，需在此同步最新数据（保持内部 contacts 与页面一致）
      // ⚠️ 必须传 contacts.value 的响应式代理，不能传原始 merged
      messageLoader?.setContacts(contacts.value);

      if (!hasCache) setSyncState("synced");
    } catch (e) {
      console.warn("[联系人] 完整数据加载失败:", e);
      // 静默刷新失败时也提示「同步失败」，让用户知道数据可能不是最新
      setSyncState("failed");
    }

    loading.value = false;

    // 6) 处理跳转参数，确定要选中的会话
    const urlParams = new URLSearchParams(window.location.search);
    const urlContactId = urlParams.get("contactId");

    let pendingContactId = localStorage.getItem("pendingContactId");
    const pendingChatType = localStorage.getItem("pendingChatType");

    if (urlContactId) {
      pendingContactId = urlContactId;
      router.replace({ path: "/message" });
    }

    let targetId = "";
    if (pendingContactId) {
      targetId =
        pendingChatType === "group"
          ? pendingContactId.startsWith("group_")
            ? pendingContactId
            : `group_${pendingContactId}`
          : pendingContactId;

      localStorage.removeItem("pendingContactId");
      localStorage.removeItem("pendingChatType");
    }

    // 7) 默认选中「当前用户自己」（无跳转参数时），并加载其聊天记录
    await ensureActiveContactLoaded(targetId || undefined);

    // 8) 待处理申请数量（与聊天内容无关，并行拉取）
    void Promise.all([loadPendingGroupApplicationCount(), loadPendingFriendApplicationCount()]);

    setSyncState("synced");

    // 检查版本更新
    checkVersionUpdate();
  } catch (error) {
    message.error("页面加载失败");
    loading.value = false;
  }
});

// 检查版本更新
const checkVersionUpdate = async () => {
  try {
    // 先通过组件内部的 checkVersionUpdate 获取数据
    if (updateReminderRef.value?.checkVersionUpdate) {
      const hasUpdate = await updateReminderRef.value.checkVersionUpdate();
      if (hasUpdate) {
        showUpdateReminder.value = true;
      }
    }
  } catch (err) {
    console.error("检查版本更新失败:", err);
  }
};

// 滚动到最新消息的优化函数
const scrollToLatestMessage = async (retryCount = 0) => {
  if (retryCount > 5) return;

  await nextTick();

  if (rightChatAreaRef.value?.scrollToBottom) {
    rightChatAreaRef.value.scrollToBottom();
  } else {
    setTimeout(() => scrollToLatestMessage(retryCount + 1), 100);
  }
};

/**
 * 选择默认会话：优先选中「当前用户自己」。
 *
 * 联系人列表排序规则里 isSelf 始终排最前，但缓存 / 数据异常时 contacts[0] 未必是自己，
 * 因此这里显式查找 isSelf 或 id === currentUserId 的联系人，找不到再退回列表首项。
 *
 * @param list 候选联系人列表（默认使用当前 contacts）
 * @returns 选中的联系人 id，列表为空时返回空字符串
 */
const pickDefaultContactId = (list: Contact[] = contacts.value): string => {
  if (!list.length) return "";

  const self = list.find((c) => c.isSelf || String(c.id) === String(currentUserId.value));
  return String((self || list[0]).id);
};

/**
 * 确保当前会话已选中并加载其聊天记录。
 *
 * 用于「默认选中当前用户」场景：选中后立即拉取历史消息，
 * 避免右侧聊天窗口停留在空白状态。
 *
 * @param preferredId 优先选中的会话 id（如跳转参数），无效时回退到默认会话
 */
const ensureActiveContactLoaded = async (preferredId?: string) => {
  if (!contacts.value.length) return;

  const exists = preferredId
    ? contacts.value.some((c) => String(c.id) === String(preferredId))
    : false;

  const targetId = exists ? String(preferredId) : pickDefaultContactId();
  if (!targetId) return;

  activeContactId.value = targetId;

  // 通知 MessageLoader 当前活跃联系人变更（用于清未读 / 通知判断）
  if (messageLoader) {
    messageLoader.setActiveContactId(targetId);
  }

  const seq = ++sessionLoadSeq;
  chatLoading.value = true;
  try {
    await getChatHistory(targetId, {
      currentUserId: currentUserId.value,
      contacts: contacts.value,
      activeContactId,
    });
    // 期间若已切换到其它会话，不再滚动（避免把用户正在看的会话拉到底部）
    if (seq !== sessionLoadSeq) return;
    await scrollToLatestMessage();
  } catch (error) {
    console.error("[联系人] 加载默认会话失败:", error);
  } finally {
    // 仅最新一次加载负责复位 loading，避免并发时提前结束
    if (seq === sessionLoadSeq) chatLoading.value = false;
  }
};

// 组件卸载
onUnmounted(async () => {
  websocketService.off("private_message", handleRealtimeMessage);
  websocketService.off("group_message", handleRealtimeMessage);
  websocketService.off("message_recalled", handleRecallMessage);
  websocketService.off("message_deleted", handleDeleteMessageFromWs);
  websocketService.off("messages_deleted", handleBatchDeleteMessagesFromWs);
  websocketService.off("group_member_level_updated", handleGroupMemberLevelUpdate);
  websocketService.off("group_member_title_updated", handleGroupMemberTitleUpdate);
  websocketService.off("friend_status_changed", handleFriendStatusChanged);
  websocketService.off("group_invite_accepted", handleGroupInviteAccepted);
  websocketService.off("friend_request_accepted", handleFriendRequestAccepted);
  websocketService.off("group_application_received", handleGroupApplicationReceived);
  websocketService.off("new_group_invitation", handleNewGroupInvitation);
  websocketService.off("group_member_joined", handleGroupMemberJoined);

  // 清理活跃会话刷新节流定时器
  activeChatRefreshTimer.forEach((timer) => clearTimeout(timer));
  activeChatRefreshTimer.clear();

  // 销毁 MessageLoader
  if (messageLoader) {
    messageLoader.destroy();
    messageLoader = null;
  }

  // 断开通话信令连接
  try {
    const { getSignalingService } = await import("../untils/signalingService");
    const service = getSignalingService();
    if (service) {
      service.disconnect();
    }
  } catch (e) {
    // 静默处理
  }
});

// ==================== WebSocket 消息处理 ====================

// 处理实时消息（使用 MessageLoader 增强）
const handleRealtimeMessage = (data: any) => {
  const msg = data.message || data;

  // 检测群邀请消息类型（groupId 可能为 null）
  const isGroupInviteType =
    msg.messageType &&
    ["group_invite_pending", "group_invite_accepted", "group_invite_rejected"].includes(
      msg.messageType,
    );

  // 群邀请消息的 groupId 从 content 中提取
  let effectiveGroupId = msg.groupId;
  if (isGroupInviteType && !effectiveGroupId) {
    try {
      const contentData = typeof msg.content === "string" ? JSON.parse(msg.content) : msg.content;
      if (contentData?.groupId) {
        effectiveGroupId = contentData.groupId;
      }
    } catch {}
  }

  const type = effectiveGroupId ? "group" : "private";

  // 优先使用 MessageLoader 处理
  if (messageLoader) {
    messageLoader.handleRealtimeMessage(data, type);
  } else {
    // 降级方案：使用原有逻辑
    handleRealtimeMessageUtil(data, type, {
      contacts: contacts.value,
      currentUserId: currentUserId.value,
      activeContactId: activeContactId.value,
      rightChatAreaRef: rightChatAreaRef.value,
      nextTick,
      notificationComponentRef,
      statusBarNotificationRef,
    });
  }

  // 收到群邀请消息（已直接加入群）时，自动刷新联系人列表
  if (msg.messageType === "group_invite_accepted") {
    // 延迟刷新确保后端数据已更新
    setTimeout(() => {
      handleRefreshContacts();
    }, 500);
  }

  // 收到新消息时，如果当前正在查看该联系人，自动滚动到底部
  const msgData = data.message || data;
  const senderId = String(msgData.senderId);
  const isGroup = !!effectiveGroupId;
  let contactId: string;
  if (isGroup) {
    const groupId = String(effectiveGroupId);
    contactId = groupId.startsWith("group_") ? groupId : `group_${groupId}`;
  } else {
    contactId = senderId === currentUserId.value ? String(msgData.receiverId) : senderId;
  }

  if (activeContactId.value === contactId) {
    // 当前正在查看该会话：向服务器重新拉取一次最新聊天记录，
    // 保证「当前聊天界面」始终与服务器一致（不依赖本地拼接的临时消息）。
    // 用 forceFetch 绕过「空历史捷径」，避免被误判为空而不请求。
    void refreshActiveChatFromServer(contactId);

    nextTick(() => {
      rightChatAreaRef.value?.scrollToBottom();
    });
  }
};

/**
 * 仅刷新「当前活跃会话」的聊天记录（向服务器请求）。
 *
 * 与 handleContactSelect 的区别：不切换会话、不显示整页 loading，
 * 只在收到该会话的新消息时静默补拉一次，让当前界面立即呈现最新内容。
 *
 * 并发保护：同一会话短时间内多次触发时做节流合并，避免消息密集时请求风暴。
 */
const activeChatRefreshTimer = new Map<string, ReturnType<typeof setTimeout>>();
const refreshActiveChatFromServer = (contactId: string) => {
  // 节流：同一会话 300ms 内只请求一次
  if (activeChatRefreshTimer.has(contactId)) return;
  activeChatRefreshTimer.set(
    contactId,
    setTimeout(async () => {
      activeChatRefreshTimer.delete(contactId);
      // 期间用户可能已切换会话，切走了就不必再拉
      if (activeContactId.value !== contactId) return;
      try {
        await getChatHistory(contactId, {
          currentUserId: currentUserId.value,
          contacts: contacts.value,
          activeContactId,
          forceFetch: true,
        });
        await scrollToLatestMessage();
      } catch {
        /* 静默失败，本地已有 WS 推送的消息兜底 */
      }
    }, 300),
  );
};

// 处理消息撤回
const handleRecallMessage = (data: any) => {
  handleRecallMessageUtil(data, messageState);
};

// 处理群邀请实时通知（通过 WebSocket 接收）
const handleGroupInvitationReceived = (data: any) => {
  console.log("[WS] 收到群邀请通知:", data);
  // 将邀请通知作为实时消息处理
  const msgData = {
    message: {
      id: data.id,
      content: data.content,
      senderId: data.senderId,
      receiverId: data.receiverId,
      groupId: data.groupId,
      messageType: data.messageType || "group_invite_pending",
      status: data.status,
      createdAt: data.createdAt,
      sender: data.sender,
      group: data.group,
    },
  };
  handleRealtimeMessage(msgData);
};

// 处理邀请被接受通知
const handleInvitationAccepted = (data: any) => {
  console.log("[WS] 邀请已被接受:", data);
  // 刷新联系人列表以获取新的群成员
  setTimeout(() => {
    handleRefreshContacts();
  }, 500);
};

// 处理邀请被拒绝通知
const handleInvitationRejected = (data: any) => {
  console.log("[WS] 邀请已被拒绝:", data);
};

// 处理「申请审批通过」通知（后端在同意加群申请后推送给新成员）
const handleGroupInviteAccepted = (data: any) => {
  console.log("[WS] 加群申请已通过:", data);
  // 刷新联系人列表拿到新群，随后强制重新拉取该群历史并重新提取入群记录。
  //
  // ⚠️ 这里必须用 forceFetch：刚通过审批入群的会话，唯一消息就是后端写入的
  //    group_invite_accepted，此时 lastMessage / unreadCount 都可能是空的，
  //    非强制请求会命中 getChatHistory 的「空历史」捷径直接返回空数组，
  //    joinMessages 提取不到，群里就永远不出现「XXX 加入了群聊」。
  setTimeout(async () => {
    // refreshGroups 已经从群详情接口读取 joinNotices 数组（含历史全部入群记录）
    await handleRefreshContacts();

    const rawGroupId = data?.groupId;
    if (!rawGroupId) return;
    const groupId = `group_${String(rawGroupId).replace(/^group_/, "")}`;

    const contact = contacts.value.find((c) => String(c.id) === groupId);
    if (!contact?.isGroup) return;

    // 兜底：接口尚未返回 joinNotices 时，仍从聊天历史反解
    if (!contact.joinNotices?.length) {
      await getChatHistory(groupId, {
        currentUserId: currentUserId.value,
        contacts: contacts.value,
        activeContactId,
        forceFetch: true,
      });
      contact.joinMessages = extractJoinMessagesUtil(contact.messages || []);
    }
  }, 500);
};

/**
 * 好友申请被对方同意 → 自动刷新联系人列表（无需手动刷新页面）。
 * 同时刷新待处理好友申请数量，让红点/角标及时更新。
 */
const handleFriendRequestAccepted = (data: any) => {
  console.log("[WS] 好友申请已被同意:", data);
  setTimeout(async () => {
    await handleRefreshContacts();
    void loadPendingFriendApplicationCount();
  }, 500);
};

/**
 * 收到新的群聊申请（有人申请加入我管理的群）→ 刷新待处理数量。
 */
const handleGroupApplicationReceived = (data: any) => {
  console.log("[WS] 收到新的群聊申请:", data);
  void loadPendingGroupApplicationCount();
};

/**
 * 收到新的群邀请（被邀请入群）→ 自动刷新联系人列表，
 * 让被邀请的群立即出现在列表中，无需手动刷新页面。
 */
const handleNewGroupInvitation = (data: any) => {
  console.log("[WS] 收到新的群邀请:", data);
  setTimeout(async () => {
    await handleRefreshContacts();
    void loadPendingGroupApplicationCount();
  }, 500);
};

// 处理消息删除
const handleDeleteMessageFromWs = (data: any) => {
  handleDeleteMessageFromWsUtil(data, messageState);
};

// 处理批量消息删除
const handleBatchDeleteMessagesFromWs = (data: any) => {
  handleBatchDeleteMessagesFromWsUtil(data, messageState);
};

// 处理群成员等级更新
const handleGroupMemberLevelUpdate = (data: any) => {
  handleGroupMemberLevelUpdateUtil(data, messageState, activeContactId.value);
};

// 处理群成员头衔更新
const handleGroupMemberTitleUpdate = (data: any) => {
  handleGroupMemberTitleUpdateUtil(data, messageState, activeContactId.value);
};

// 处理好友在线状态变化
const handleFriendStatusChanged = (data: any) => {
  const { userId, status } = data;
  const isOnline = status === 0;

  // 更新联系人列表中的在线状态（同时更新 isOnline 和 status，保证一致）
  const index = contacts.value.findIndex((c) => String(c.id) === String(userId));
  if (index !== -1) {
    contacts.value[index] = {
      ...contacts.value[index],
      isOnline,
      status: status,
    };
  }

  // 如果当前活跃联系人就是该好友，同步更新其在线状态
  if (activeContactId.value === String(userId) && rightChatAreaRef.value) {
    rightChatAreaRef.value.updateContactOnlineStatus?.(isOnline);
  }
};

/**
 * 群成员加入（后端在成员入群时广播 group_member_joined）→ 实时更新入群通知。
 *
 * 群里不再显示群邀请卡片，入群通知统一由消息列表顶部的「XXX 加入了群聊」提示条展示。
 * 这里把新成员追加进对应群联系人的 joinMessages，让提示条无需刷新页面即可出现。
 */
/**
 * 把 ISO 时间格式化成与后端一致的展示串（今天 HH:mm / 昨天 HH:mm / M-D HH:mm）。
 * 后端 joinNotices 返回的 time 已是这个格式，这里用于 WS 实时追加的那条通知。
 */
const formatNoticeTime = (value?: string): string => {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const hhmm = `${d.getHours()}:${pad(d.getMinutes())}`;

  if (day.getTime() === today.getTime()) return `今天 ${hhmm}`;
  if (day.getTime() === yesterday.getTime()) return `昨天 ${hhmm}`;
  if (d.getFullYear() === now.getFullYear()) {
    return `${d.getMonth() + 1}-${d.getDate()} ${hhmm}`;
  }
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${hhmm}`;
};

const handleGroupMemberJoined = (data: any) => {
  const groupId = data?.groupId;
  if (!groupId) return;
  const contactId = String(groupId).startsWith("group_") ? String(groupId) : `group_${groupId}`;
  const contact = contacts.value.find((c) => String(c.id) === contactId);
  if (!contact?.isGroup) return;

  const newMember = data.newMember || {};
  const joinedAt = data.timestamp || new Date().toISOString();
  const userId = String(newMember.id ?? "");
  if (!userId) return;

  // 追加到后端同构的 joinNotices 数组（权威字段），保证提示条无需刷新即可出现
  if (!Array.isArray(contact.joinNotices)) contact.joinNotices = [];
  const notice = {
    userId,
    userName: newMember.name || newMember.nickname || newMember.username || "用户",
    userAvatar: newMember.avatar || "",
    operatorId: data.operatorId != null ? String(data.operatorId) : null,
    operatorName: data.operatorName || null,
    source: data.source || "invite",
    memberCount: data.memberCount ?? null,
    message: data.message || "加入了群聊",
    joinedAt,
    time: formatNoticeTime(joinedAt),
  };

  // 去重：同一用户 + 相近时间只记一次
  const exists = contact.joinNotices.some(
    (n: any) =>
      String(n.userId) === userId &&
      Math.abs(getMessageTimestamp(n.joinedAt || n.time) - getMessageTimestamp(joinedAt)) < 3000,
  );

  if (!exists) {
    contact.joinNotices.push(notice);
    contact.joinNotices.sort(
      (a: any, b: any) =>
        getMessageTimestamp(a.joinedAt || a.time) - getMessageTimestamp(b.joinedAt || b.time),
    );

    // 同步维护旧字段，保证未升级的展示逻辑也能看到
    if (!Array.isArray(contact.joinMessages)) contact.joinMessages = [];
    contact.joinMessages.push({
      userId,
      userName: notice.userName,
      time: joinedAt,
    });

    // 触发响应式更新
    const idx = contacts.value.findIndex((c) => String(c.id) === contactId);
    if (idx !== -1) contacts.value[idx] = { ...contacts.value[idx] };
  }
};

// 初始化 WebSocket 消息监听
const initializeWebSocketMessageListener = () => {
  websocketService.on("private_message", handleRealtimeMessage);
  websocketService.on("group_message", handleRealtimeMessage);
  websocketService.on("message_recalled", handleRecallMessage);
  websocketService.on("message_deleted", handleDeleteMessageFromWs);
  websocketService.on("messages_deleted", handleBatchDeleteMessagesFromWs);
  websocketService.on("group_member_level_updated", handleGroupMemberLevelUpdate);
  websocketService.on("group_member_title_updated", handleGroupMemberTitleUpdate);
  // 群成员加入 → 实时更新入群通知提示条
  websocketService.on("group_member_joined", handleGroupMemberJoined);
  // 群邀请实时通知
  websocketService.on("new_group_invitation", handleGroupInvitationReceived);
  websocketService.on("invitation_accepted", handleInvitationAccepted);
  websocketService.on("invitation_rejected", handleInvitationRejected);
  // 申请审批通过后，后端推送给新成员：刷新列表并展示入群通知
  websocketService.on("group_invite_accepted", handleGroupInviteAccepted);
  // 好友申请被同意 → 自动刷新联系人列表（无需手动刷新页面）
  websocketService.on("friend_request_accepted", handleFriendRequestAccepted);
  // 收到新的群聊申请 → 刷新待处理数量
  websocketService.on("group_application_received", handleGroupApplicationReceived);
  // 被邀请入群 → 自动刷新联系人列表
  websocketService.on("new_group_invitation", handleNewGroupInvitation);
};

// ==================== 联系人操作封装 ====================

// 联系人选择
const handleContactSelect = async (contactId: string) => {
  activeContactId.value = contactId;
  const seq = ++sessionLoadSeq;
  chatLoading.value = true;

  try {
    // 通知 MessageLoader 当前活跃联系人变更
    if (messageLoader) {
      messageLoader.setActiveContactId(contactId);
    }

    // 先读取「已读游标」（上次读到的最后一条消息 id），用于渲染「新消息」分割线；
    // 再加载历史、最后标记已读（mark-read 会把游标推进到当前最新消息）。
    const readCursor = await getReadCursor(contactId);
    const targetContact = contacts.value.find((c) => String(c.id) === String(contactId));
    if (targetContact && typeof readCursor === "number") {
      targetContact.readCursor = readCursor;
    }

    await getChatHistory(activeContactId.value, {
      currentUserId: currentUserId.value,
      contacts: contacts.value,
      activeContactId,
    });

    await markMessagesAsRead(contactId, contacts.value);

    // 群聊：加载历史后重新提取入群记录，保证「入群通知」及时显示
    // （joinMessages 依赖 messages 里的 group_invite_* 消息，历史加载完成后才有数据）
    const activeContact = contacts.value.find((c) => String(c.id) === String(contactId));
    if (activeContact?.isGroup && activeContact.messages?.length) {
      activeContact.joinMessages = extractJoinMessagesUtil(activeContact.messages);
    }

    // 期间若已切换到其它会话，不再滚动
    if (seq !== sessionLoadSeq) return;
    // 选择联系人后滚动到最新消息
    await scrollToLatestMessage();
  } catch (error) {
    console.error("[联系人] 切换会话失败:", error);
  } finally {
    // 仅最新一次加载负责复位 loading
    if (seq === sessionLoadSeq) chatLoading.value = false;
    // 切换会话不触发顶部同步提示：这是高频操作，弹提示会频繁闪烁且无必要
  }
};

// 关闭联系人抽屉
const closeContactDrawer = () => {
  if (rightChatAreaRef.value) {
    rightChatAreaRef.value.closeContactDrawer && rightChatAreaRef.value.closeContactDrawer();
  }
};

// 更新联系人
const handleUpdateContact = async (contact: Contact) => {
  const index = contacts.value.findIndex((c) => String(c.id) === String(contact.id));
  if (index !== -1) {
    contacts.value[index] = { ...contacts.value[index], ...contact };
  }
};

// 刷新联系人列表（使用 MessageLoader 同步）
// 刷新联系人列表（复用统一刷新入口 reloadContacts，避免重复逻辑）
const handleRefreshContacts = async (forceRefresh = false) => {
  loading.value = true;
  try {
    await reloadContacts(false, forceRefresh);
  } finally {
    loading.value = false;
  }
};

// 加载待处理群聊申请数量
const loadPendingGroupApplicationCount = async () => {
  try {
    const response: any = await request.get("/group/applications/pending-count");

    pendingGroupApplicationCount.value = response.data?.count || 0;
  } catch (error) {
    // 静默失败
  }
};

/**
 * 监听「当前登录用户」资料变化（侧边栏编辑昵称 / 头像后），
 * 同步更新联系人列表里的「自己」会话。
 *
 * 背景：self contact 的 name / avatar 只在创建时从 userStore 读取一次，
 * 之后在侧边栏改资料不会自动同步，导致联系人列表里的自己还是旧头像 / 旧昵称。
 */
watch(
  () => [userStore.user?.nickname, userStore.user?.avatar, userStore.user?.username],
  () => {
    const selfId = String(currentUserId.value || userStore.user?.id || "");
    if (!selfId) return;
    const selfContact = contacts.value.find((c) => String(c.id) === selfId && !c.isGroup);
    if (!selfContact) return;

    selfContact.name = userStore.user?.nickname || userStore.user?.username || selfContact.name;
    if (userStore.user?.avatar) selfContact.avatar = userStore.user.avatar;
    selfContact.username = userStore.user?.username || selfContact.username;

    // 触发响应式更新（原地修改对象属性，需让数组感知）
    const idx = contacts.value.findIndex((c) => String(c.id) === selfId);
    if (idx !== -1) contacts.value[idx] = { ...contacts.value[idx] };
  },
);

// 监听 contacts 变化：合并写回本地缓存（消息到达、已读、局部更新都会触发）
watch(
  () => contacts.value,
  () => {
    scheduleCacheSync();
  },
  { deep: true },
);

// 页面卸载前把最新数据落盘，避免节流窗口内的改动丢失
onBeforeUnmount(() => {
  if (cacheSyncTimer) {
    clearTimeout(cacheSyncTimer);
    cacheSyncTimer = null;
  }
  // 清理「已同步完成」的自动隐藏定时器
  if (syncHideTimer) {
    clearTimeout(syncHideTimer);
    syncHideTimer = null;
  }
  // 清理 syncing 最短展示时长定时器
  if (syncingMinTimer) {
    clearTimeout(syncingMinTimer);
    syncingMinTimer = null;
  }
  saveContactsCache(currentUserId.value, contacts.value);
});

// 加载待处理好友申请数量
const loadPendingFriendApplicationCount = async () => {
  try {
    const response: any = await request.get("/friends/applications/pending-count");

    pendingFriendApplicationCount.value = response.data?.count || 0;
  } catch (error) {
    // 静默失败
  }
};

// ==================== 聊天操作封装 ====================

// 发送消息
const handleSendMessageWrapper = async (data: any) => {
  let contactId, userInfo;

  if (typeof data === "object" && data.userId) {
    contactId = data.userId;
    userInfo = data.userInfo;
  } else {
    contactId = data;
  }

  const sendOptions = {
    currentUserId: currentUserId.value,
    contacts: contacts.value,
    activeContactId: activeContactId,
    rightChatAreaRef: rightChatAreaRef.value,
  };

  const existingContact = contacts.value.find((c) => String(c.id) === String(contactId));

  // 无论联系人是否存在，都切换到该联系人
  activeContactId.value = String(contactId);

  if (!existingContact) {
    if (!userInfo) {
      try {
        const tempChatResult = await prepareTemporaryChat(contactId);
        userInfo = {
          id: tempChatResult.id,
          name: tempChatResult.name,
          avatar: tempChatResult.avatar,
          username: tempChatResult.username,
          isOnline: tempChatResult.isOnline,
        };
      } catch (error) {
        // 静默处理
      }
    }
  }

  if (!existingContact && userInfo) {
    const newContact: Contact = {
      id: String(userInfo.id),
      name: userInfo.name,
      avatar: userInfo.avatar,
      lastMessage: "",
      lastMessageTime: "",
      unreadCount: 0,
      isOnline: userInfo.isOnline,
      messages: [],
      remark: "",
      isTop: false,
      isMuted: false,
      isGroup: false,
      username: userInfo.username,
    };

    contacts.value.push(newContact);
  }

  await handleSendMessage(
    contactId,
    "",
    sendOptions,
    { user: { id: currentUserId.value } },
    "text",
    undefined,
    undefined,
    undefined,
    undefined,
  );

  if (userInfo && !existingContact) {
    await handleRefreshContacts();
  }

  // 发送消息后滚动到底部
  await scrollToLatestMessage();
};

// 编辑备注
const handleEditRemarkWrapper = async (contactId: string | number, remark: string) => {
  await handleEditRemark(contactId, remark, contacts.value);
};
// 清空聊天（单向删除：仅自己视角清空，对方 / 群成员不受影响）
const handleClearChatWrapper = async (contactId: string | number) => {
  const targetId = String(contactId);

  // 1. 本地立即清空该会话的消息与摘要，避免刷新前短暂残留
  const contact = contacts.value.find((c) => String(c.id) === targetId);
  if (contact) {
    contact.messages = [];
    contact.lastMessage = "";
    contact.lastMessageTime = "";
    contact.lastMessageAt = "";
    contact.unreadCount = 0;
  }

  // 2. 清除聊天历史分页缓存（内含 chatHistoryPagination 清理）
  invalidateChatHistoryCache(contacts.value, targetId);

  // 3. 刷新联系人列表，让 lastMessage 等元数据与后端（已被过滤后的最新消息）一致
  await handleRefreshContacts();

  // 4. 关闭抽屉
  closeContactDrawer();
};

// 切换置顶
const handleToggleTopWrapper = async (contactId: string | number, isTop: boolean) => {
  const toggleOptions = {
    currentUserId: currentUserId.value,
    contacts: contacts.value,
    activeContactId: activeContactId,
  };
  await handleToggleTop(contactId, isTop, toggleOptions);
  closeContactDrawer();
};

// 切换免打扰
const handleToggleMuteWrapper = async (contactId: string | number, isMuted: boolean) => {
  const toggleOptions = {
    currentUserId: currentUserId.value,
    contacts: contacts.value,
    activeContactId: activeContactId,
  };
  await handleToggleMute(contactId, isMuted, toggleOptions);
  closeContactDrawer();
};

// 删除好友
const handleDeleteFriendWrapper = async (contactId: string | number) => {
  closeContactDrawer();
  await handleRefreshContacts();
};

// 退出群聊
const handleQuitGroupWrapper = async (groupId: string) => {
  closeContactDrawer();
  if (activeContactId.value === groupId) {
    activeContactId.value = "";
  }
  await handleRefreshContacts();
};

// 解散群聊
const handleDissolveGroupWrapper = async (groupId: string) => {
  closeContactDrawer();
  if (activeContactId.value === groupId) {
    activeContactId.value = "";
  }
  await handleRefreshContacts();
};

// 删除临时会话
const handleDeleteTemporaryContactWrapper = async (contactId: string | number) => {
  closeContactDrawer();
  if (activeContactId.value === String(contactId)) {
    activeContactId.value = "";
  }
  await handleRefreshContacts();
};

// 更新群规
const handleUpdateGroupRuleWrapper = async (groupId: string | number, rule: string) => {
  await handleUpdateGroupRule(groupId, rule, contacts.value);
};

// ==========================================
// 信令服务（通话）
// ==========================================

/**
 * 初始化信令监听
 */
const initializeSignalingListener = async () => {
  try {
    const { getSignalingService, addGlobalSignalingListener } =
      await import("../untils/signalingService");
    const userStore = useUserStore();
    const service = getSignalingService();

    // 确保获取到有效的用户ID
    const userId = String(userStore.user?.id || currentUserId.value);
    if (userId && userId !== "current-user") {
      await service.connect(userId);

      addGlobalSignalingListener((msg) => {
        switch (msg.type) {
          case "call_offer":
            handlePrivateCallOffer({
              callerId: msg.from,
              callType: msg.callType || "audio",
              callerName: msg.callerName,
              callerAvatar: msg.callerAvatar,
              sdp: msg.data?.signal,
            });
            break;
          case "end_call":
            // 处理通话结束
            const callStore = useCallStore();
            if (callStore.isCalling || callStore.isInCall) {
              const userId = String(userStore.user?.id || "");
              const contactId = String(msg.from || "");
              const callType = (callStore.callType || "audio") as "audio" | "video";

              // 如果还在振铃阶段收到 end_call，说明对方取消了/拒绝了
              if (callStore.isCalling && !callStore.isInCall) {
                // 判断：如果我是呼叫方，对方拒绝；如果我是接收方，对方取消
                const isCaller = callStore.callerId === userId;
                const status = isCaller ? "rejected" : "cancelled";

                // 给用户提示
                const reason = msg.data?.reason || "";
                if (isCaller && reason === "declined") {
                  message.warning("对方拒绝了通话");
                } else if (isCaller) {
                  message.info("对方取消了通话");
                }

                const callMsg = createCallMessage(userId, contactId, callType, status, 0, true, {
                  nickname: userStore.user?.nickname,
                  username: userStore.user?.username,
                  avatar: userStore.user?.avatar,
                  id: userId,
                });
                insertCallMessageToContact(contacts.value, contactId, callMsg);
                // 发送通话记录到服务器
                sendCallRecordToServer(contactId, callType, status, 0);
              } else if (callStore.isInCall) {
                // 通话中对方挂断，插入通话结束记录
                message.info("对方已挂断通话");
                const duration = callStore.callDuration;
                const callMsg = createCallMessage(
                  userId,
                  contactId,
                  callType,
                  "ended",
                  duration,
                  true,
                  {
                    nickname: userStore.user?.nickname,
                    username: userStore.user?.username,
                    avatar: userStore.user?.avatar,
                    id: userId,
                  },
                );
                insertCallMessageToContact(contacts.value, contactId, callMsg);
                // 发送通话记录到服务器
                sendCallRecordToServer(contactId, callType, "ended", duration);
              }
              callStore.endCall(true); // skipCallRecord=true，避免重复插入
            }
            break;
        }
      });
    }
  } catch (error) {
    // 静默处理
  }
};

/**
 * 处理私聊通话邀请
 */
const handlePrivateCallOffer = (data: any) => {
  const targetId = String(data.callerId);
  const user = contacts.value.find((c) => String(c.id) === targetId);

  // 通知全局来电组件显示弹窗（每次通话都显示）
  if ((window as any).globalCallNotificationRef) {
    (window as any).globalCallNotificationRef.handleCallInvite({
      ...data,
      avatar: user?.avatar || data.callerAvatar || data.avatar || "",
      callerName:
        user?.remark || user?.name || data.callerName || data.callerDisplayName || "未知联系人",
      isGroup: false,
    });
  }

  // 如果确实找不到联系人，给一个提示
  if (!user) {
    message.warning("收到未知用户的通话邀请");
  }
};
</script>

<style scoped>
.page-wrapper {
  width: 100%;
  height: 100vh;
  overflow: hidden;
}

.qq-chat-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: relative;
  overflow: hidden;
}

/* 动态背景时，主内容层浮在视频之上 */
.qq-chat-container.has-dynamic-bg .qq-main {
  position: relative;
  z-index: 1;
}

.qq-main {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.message-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.chat-main-area {
  flex: 1;
  display: flex;
  overflow: hidden;
}
</style>
