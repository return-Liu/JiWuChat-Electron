/**
 * 消息页面管理器 - 优化版
 * 核心功能：所有联系人收到新消息时立即更新最近一条消息，无需切换界面
 */

import type { Contact } from "../types/chatTypes";
import type {
  ComponentContact,
  MessagePageOptions,
  MessagePageState,
} from "../types/untilsTypes";
import {
  getTopStatusFromLocalStorage,
  getMuteStatusFromLocalStorage,
  sortContacts,
  formatMessageContent,
  updateContactLastMessage,
  invalidateChatHistoryCache,
  getMessageTimestamp,
  shouldReplaceContactSummary,
  getChatPartnerMyGroupNickname,
  buildMediaSummaryText,
} from "./contactManager";
import request from "./request";
import { message } from "ant-design-vue";
import { GROUP_INVITE_TYPES } from "../types/constants";
import { ref } from "vue";
import { useNotificationStore } from "../stores/notification";
import { useChatWorkspaceStore } from "../stores/chatWorkspace";
import { useUserStore } from "../stores/user";

export type { MessagePageState, MessagePageOptions } from "../types/untilsTypes";

// ==========================================
// 数据转换工具
// ==========================================

// getChatPartnerMyGroupNickname 统一由 contactManager 提供，这里 re-export 保持对外 API 不变，
// 避免两处重复定义（改一处漏一处）。
export { getChatPartnerMyGroupNickname };

interface GroupMetaFromLatest {
  groupNumber: string;
  tags: any[];
  admin: any[];
  owner: any;
  memberCount: number;
  allowMemberInvite: boolean;
}

const resolveGroupMetaFromLatest = (latest: any): GroupMetaFromLatest => {
  const groupPayload = latest?.group || latest?.groupData || latest?.groupInfo || {};
  const members = Array.isArray(latest?.members)
    ? latest.members
    : Array.isArray(groupPayload?.members)
      ? groupPayload.members
      : [];

  const resolvedGroupNumber =
    latest?.groupNumber ||
    groupPayload?.groupNumber ||
    latest?.number ||
    groupPayload?.number ||
    "";

  const resolvedTags = Array.isArray(latest?.tags)
    ? latest.tags
    : Array.isArray(groupPayload?.tags)
      ? groupPayload.tags
      : [];

  const resolvedAdmin = Array.isArray(latest?.admin)
    ? latest.admin
    : Array.isArray(groupPayload?.admin)
      ? groupPayload.admin
      : members
        .filter((member: any) => String(member?.role || "").toLowerCase() === "admin")
        .map((member: any) => ({
          id: member.id ?? member.userId ?? member.user?.id,
          name: member.name ?? member.nickname ?? member.username ?? "管理员",
          role: "admin",
          avatar: member.avatar,
        }));

  const resolvedOwner = latest?.owner || groupPayload?.owner || undefined;
  const resolvedMemberCount =
    latest?.memberCount ?? groupPayload?.memberCount ?? members.length ?? 0;
  const resolvedAllowMemberInvite =
    latest?.allowMemberInvite ?? groupPayload?.allowMemberInvite ?? true;

  return {
    groupNumber: resolvedGroupNumber ? String(resolvedGroupNumber) : "",
    tags: resolvedTags,
    admin: resolvedAdmin,
    owner: resolvedOwner,
    memberCount: resolvedMemberCount,
    allowMemberInvite: resolvedAllowMemberInvite,
  };
};

export const createSelfContact = (currentUserId?: string): Contact => {
  const userStore = useUserStore();
  const selfId = String(currentUserId ?? userStore.user?.id ?? "current-user");

  return {
    id: selfId,
    name: userStore.user?.nickname || userStore.user?.username || "当前用户",
    avatar:
      userStore.user?.avatar ||
      "https://cube.elemecdn.com/9/c2/f0ee8a3c7c9638a54940382568c9dpng.png",
    lastMessage: "",
    lastMessageTime: "",
    unreadCount: 0,
    isOnline: userStore.user?.status === 0,
    status: userStore.user?.status ?? 0,
    messages: [],
    remark: "",
    isTop: false,
    isMuted: false,
    isGroup: false,
    isFriend: false,
    isSelf: true,
    username: userStore.user?.username || "",
  } as Contact;
};

const ensureCurrentUserContact = (contacts: Contact[], currentUserId: string) => {
  const selfId = String(currentUserId || "current-user");
  const selfContact = createSelfContact(selfId);

  const existingIndex = contacts.findIndex(
    (c) => String(c.id) === selfId && !c.isGroup,
  );

  if (existingIndex >= 0) {
    const existing = contacts[existingIndex];
    // ⚠️ 只刷新「自己」的元数据（昵称/头像/在线状态），
    //    绝不能把 selfContact.messages（空数组）覆盖上去——
    //    否则每次页面重新可见（切到编辑器再切回）都会清空自己会话的聊天记录。
    contacts[existingIndex] = {
      ...existing,
      ...selfContact,
      // 运行时字段：以已有数据为准，避免被空值覆盖
      messages: existing.messages ?? [],
      chatHistoryPagination: existing.chatHistoryPagination,
      id: selfId,
      isGroup: false,
      isFriend: false,
      isSelf: true,
    };
    return;
  }

  contacts.unshift(selfContact);
};

export const convertToComponentContact = (
  contact: Contact,
): ComponentContact => ({
  id: String(contact.id),
  name: contact.name,
  avatar: contact.avatar,
  lastMessage: contact.lastMessage,
  lastMessageTime: contact.lastMessageTime,
  lastMessageAt: contact.lastMessageAt,
  unreadCount: contact.unreadCount,
  isOnline: contact.isOnline,
  remark: contact.remark,
  isTop: contact.isTop,
  isMuted: contact.isMuted,
  isGroup: contact.isGroup,
  groupNumber: contact.groupNumber,
  groupOwnerId: contact.groupOwnerId,
  messages: contact.messages,
  myGroupNickname: contact.myGroupNickname,
});

// ==========================================
// 联系人状态管理
// ==========================================

export const restoreContactStates = (
  contacts: Contact[],
  currentUserId: string,
) => {
  return useChatWorkspaceStore().restoreContactStates(contacts, currentUserId);
};

export const triggerContactsUpdate = (contacts: Contact[]) => {
  return useChatWorkspaceStore().triggerContactsUpdate(contacts);
};

export const triggerContactUpdate = (
  contacts: Contact[],
  contactId: string,
) => {
  return useChatWorkspaceStore().triggerContactUpdate(contacts, contactId);
};

// ==========================================
// 群聊数据加载
// ==========================================

/**
 * 群详情请求去重表：key = 会话侧群ID（`group_91`）。
 * 同一群的详情在短时间内会被多处拉取（列表刷新、打开会话、群抽屉补成员），
 * 以前各自 `request.get('/group/xx')` 造成同一个接口连发多次。
 * 这里做 in-flight 合并 + 短缓存，重复调用直接复用同一个 Promise。
 */
const GROUP_DETAIL_TTL = 3000;
const groupDetailCache = new Map<string, { at: number; promise: Promise<any> }>();

/**
 * 拉取群详情。
 * @param groupId 会话侧群ID（`group_91`）或纯数字（内部统一补成带前缀形式）
 */
export const fetchGroupDetail = async (groupId: string | number): Promise<any> => {
  const key = String(groupId).startsWith("group_") ? String(groupId) : `group_${groupId}`;
  const cached = groupDetailCache.get(key);
  if (cached && Date.now() - cached.at < GROUP_DETAIL_TTL) {
    return cached.promise;
  }

  const promise = request
    .get(`/group/${key}`)
    .then(({ data }) => data)
    .catch((err) => {
      // 失败不缓存，下次可重试
      groupDetailCache.delete(key);
      throw err;
    });

  groupDetailCache.set(key, { at: Date.now(), promise });
  return promise;
};

export const refreshGroups = async (
  contacts: Contact[],
  currentUserId: string,
  options?: {
    fetchRecentMessages?: boolean;
    loadHistory?: boolean;
  },
): Promise<Contact[]> => {
  const userStore = await import("../stores/user").then((m) =>
    m.useUserStore(),
  );
  const { getChatHistory } = await import("./contactManager");

  const { fetchRecentMessages = true, loadHistory = true } = options || {};

  try {
    const baseContacts = contacts.filter((contact) => !contact.isGroup);

    const { data } = await request.get("/group");
    const groups = data.groups || [];
    const newGroups: Contact[] = [];

    const groupDetailPromises = groups.map((group: any) =>
      fetchGroupDetail(group.id)
        .then((groupData) => ({ group, groupData }))
        .catch(() => null),
    );
    const groupDetails = (await Promise.all(groupDetailPromises)).filter(
      Boolean,
    ) as { group: any; groupData: any }[];

    for (const { group, groupData } of groupDetails) {
      const groupId = `group_${group.id}`;
      const groupMembers = Array.isArray(groupData.members) ? groupData.members : [];
      const currentMember = groupMembers.find(
        (m: any) => String(m.id ?? m.userId ?? m.user?.id) === String(userStore.user?.id),
      );

      const unreadCount = groupData.unreadCount ?? group.unreadCount ?? 0;
      const resolvedGroupNumber =
        groupData.groupNumber ||
        group.groupNumber ||
        group.number ||
        groupData.number ||
        "";
      const derivedAdmins =
        Array.isArray(groupData.admin) && groupData.admin.length > 0
          ? groupData.admin
          : groupMembers
            .filter((member: any) => String(member?.role || "").toLowerCase() === "admin")
            .map((member: any) => ({
              id: member.id ?? member.userId ?? member.user?.id,
              name: member.name ?? member.nickname ?? member.username ?? "管理员",
              avatar: member.avatar,
              role: "admin",
            }));

      const groupContact: Contact = {
        id: groupId,
        name: group.name,
        avatar: group.avatar,
        lastMessage: "",
        lastMessageTime: "",
        unreadCount,
        isOnline: false,
        messages: [],
        remark: groupData.remark || "",
        isTop: false,
        isMuted: false,
        isGroup: true,
        role: group.role,
        groupNumber: resolvedGroupNumber ? String(resolvedGroupNumber) : "",
        groupRule: group.rule,
        groupOwnerId: groupData.owner ? String(groupData.owner.id) : "",
        owner: groupData.owner,
        admin: derivedAdmins,
        // 优先用后端返回的 memberCount，缺失时回退到 members 数组长度，
        // 保证「人数」这个轻量字段永远有正确值（供缓存保留、头部/列表显示）
        memberCount: groupData.memberCount ?? groupMembers.length ?? 0,
        allowMemberInvite: groupData.allowMemberInvite ?? true,
        groupMembers:
          groupMembers.map((m: any) => ({
            id: String(m.id ?? m.userId ?? m.user?.id ?? ""),
            name: m.name,
            avatar: m.avatar,
            role: m.role,
            joinTime: m.joinTime,
            nickname: m.nickname || null,
            tags: m.tags || [],
            chatLevel: m.chatLevel || 1,
            messageCount: m.messageCount || 0,
            groupTitle: m.groupTitle || null,
            isBot: m.isBot === true || undefined,
          })) || [],
        joinMessages: [],
        // 🔥 入群通知：直接用后端群详情返回的 joinNotices 数组（权威数据源，含全部历史记录）
        joinNotices: Array.isArray(groupData.joinNotices) ? groupData.joinNotices : [],
        myGroupNickname: currentMember?.nickname || "",
        myGroupTags: currentMember?.tags || [],
        tags: groupData.tags || [],
        // 群聊风险等级（QQ 式安全提醒，由后端举报聚合得出）
        riskLevel: groupData.riskLevel || "normal",
        riskReportCount: groupData.riskReportCount || 0,
        riskReasons: groupData.riskReasons || [],
      };

      if (!newGroups.some((g) => g.id === groupId))
        newGroups.push(groupContact);
    }

    const updatedContacts = [...baseContacts, ...newGroups];
    const recentApplied = typeof document !== "undefined" && !document.hidden;
    if (recentApplied && fetchRecentMessages) {
      await fetchAllRecentMessages(updatedContacts, currentUserId);
    }

    if (loadHistory) {
      const historyPromises = newGroups.map(async (groupContact) => {
        try {
          // 🔥 修复：即使 lastMessage 为空，也尝试加载历史（首次加载时 lastMessage 可能为空）
          // 只有当明确确认没有历史消息时才跳过。
          // 注意：这里不能清空 joinMessages —— 入群记录可能来自 WS 的 group_member_joined，
          // 清掉后「XXX 加入了群聊」提示条会凭空消失。
          if (
            recentApplied &&
            groupContact.chatHistoryPagination?.total === 0 &&
            !groupContact.chatHistoryPagination?.hasNextPage
          ) {
            return;
          }

          const historyResult = await getChatHistory(
            groupContact.id,
            {
              currentUserId: String(userStore.user?.id),
              contacts: updatedContacts,
              activeContactId: ref(String(groupContact.id)),
            },
            1,
            50,
          );

          groupContact.messages = (historyResult.messages ||
            []) as Contact["messages"];
          const joinMsgs = extractJoinMessages(groupContact.messages || []);
          groupContact.joinMessages = joinMsgs;
        } catch (err) {
          // 静默失败
        }
      });

      await Promise.all(historyPromises);
    }

    return updatedContacts;
  } catch (err) {
    message.error("刷新群聊失败");
    return contacts;
  }
};

export const extractJoinMessages = (messages: any[]) => {
  return useChatWorkspaceStore().extractJoinMessages(messages);
};

// ==========================================
// 好友数据加载
// ==========================================

export const fetchFriendsList = async (): Promise<Contact[]> => {
  const { getFriends } = await import("./friendManager");
  const userStore = await import("../stores/user").then((m) =>
    m.useUserStore(),
  );

  try {
    const friendsData = await getFriends("accepted");
    const friendContacts: Contact[] = [];

    for (const friend of friendsData) {
      if (String(friend.friendUser?.id) === String(userStore.user?.id))
        continue;

      const friendContact: Contact = {
        id: String(friend.friendUser?.id || friend.friendId || friend.id || ""),
        name:
          friend.friendUser?.nickname ||
          friend.friendUser?.username ||
          "未知用户",
        avatar:
          friend.friendUser?.avatar ||
          "https://cube.elemecdn.com/9/c2/f0ee8a3c7c9638a54940382568c9dpng.png",
        lastMessage: "",
        lastMessageTime: "",
        unreadCount: friend.unreadCount || 0,
        isOnline: (friend.friendUser?.status || 0) === 0,
        messages: [],
        remark: friend.remark || "",
        isTop: false,
        isMuted: false,
        isGroup: false,
        isFriend: true,
        // 机器人好友：后端好友列表里带 isBot / category=robot，透传给会话用于隐藏通话等能力
        isBot:
          friend.isBot === true ||
          friend.friendUser?.isBot === true ||
          friend.category === "robot",
        username: friend.friendUser?.username || "",
        onlineVisibility: friend.friendUser?.onlineVisibility ?? 0,
        status: friend.friendUser?.status,
      };

      if (friendContact.id) friendContacts.push(friendContact);
    }
    return friendContacts;
  } catch (err) {
    message.error("获取好友列表失败");
    return [];
  }
};

// ==========================================
// 消息加载器
// ==========================================

export class MessageLoader {
  private contacts: Contact[] = [];
  private currentUserId: string = "";
  private updateCallbacks: ((contacts: Contact[]) => void)[] = [];
  private refreshDebounceTimer: number | null = null;
  private readCursorTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  private visibilityHandler: (() => void) | null = null;
  private notificationComponentRef: any = null;
  private statusBarNotificationRef: any = null;
  private router: any = null;
  private activeContactId: { value: string } = { value: "" };

  constructor(contacts: Contact[], currentUserId: string) {
    this.contacts = contacts;
    this.currentUserId = currentUserId;
    this.setupVisibilityChangeListener();
  }

  /** 🔥 设置通知相关参数 */
  setNotificationOptions(options: {
    notificationComponentRef?: any;
    statusBarNotificationRef?: any;
    router?: any;
    activeContactId?: { value: string };
  }) {
    if (options.notificationComponentRef) this.notificationComponentRef = options.notificationComponentRef;
    if (options.statusBarNotificationRef) this.statusBarNotificationRef = options.statusBarNotificationRef;
    if (options.router) this.router = options.router;
    if (options.activeContactId) this.activeContactId = options.activeContactId;
  }

  onUpdate(callback: (contacts: Contact[]) => void) {
    this.updateCallbacks.push(callback);
  }

  private notifyUpdate() {
    const updatedContacts = [...this.contacts];
    this.updateCallbacks.forEach((cb) => {
      try {
        cb(updatedContacts);
      } catch (err) {
        console.error("更新回调执行失败:", err);
      }
    });
  }

  private setupVisibilityChangeListener() {
    if (typeof document === "undefined") return;

    this.visibilityHandler = () => {
      if (!document.hidden) {
        console.log("[MessageLoader] 页面变为可见，同步最新消息");
        if (this.refreshDebounceTimer) {
          clearTimeout(this.refreshDebounceTimer);
        }
        this.refreshDebounceTimer = window.setTimeout(() => {
          this.syncAllRecentMessages();
          this.refreshDebounceTimer = null;
        }, 300);
      }
    };
    document.addEventListener("visibilitychange", this.visibilityHandler);
  }

  private async syncAllRecentMessages(): Promise<void> {
    try {
      // 页面恢复可见时强制刷新，绕过前后端缓存，拿到最新消息摘要
      const { data } = await request.get("/message/latest", { params: { refresh: 1 } });
      // 🔥 兼容后端返回的多种格式
      let messages = data.recentMessages || data.messages || [];
      if (messages && typeof messages === "object" && !Array.isArray(messages) && Array.isArray(messages.messages)) {
        messages = messages.messages;
      }
      if (!Array.isArray(messages) || messages.length === 0) return;

      const topMap = getTopStatusFromLocalStorage();
      const muteMap = getMuteStatusFromLocalStorage();
      ensureCurrentUserContact(this.contacts, this.currentUserId);

      // 为 /message/latest 里出现的会话建立「会话Key → 最新消息」映射，
      // 每个会话只保留最新一条，用于驱动联系人列表渲染。
      const msgMap = new Map<string, any>();
      messages.forEach((m: any) => {
        const key = m.groupId
          ? String(m.groupId).startsWith("group_")
            ? String(m.groupId)
            : `group_${m.groupId}`
          : [String(m.senderId), String(m.receiverId)].sort().join("_");

        const existing = msgMap.get(key);
        if (
          !existing ||
          getMessageTimestamp(m.createdAt) > getMessageTimestamp(existing.createdAt)
        ) {
          msgMap.set(key, m);
        }
      });

      // 1) 先把 /message/latest 里的会话补进联系人列表（列表里没有的才创建）。
      //    这样即使 contacts 只有「当前用户」，好友/群聊也能直接渲染出来。
      for (const [key, latest] of msgMap) {
        // self 会话（自己给自己发）不需要作为联系人展示，跳过
        if (latest.chatType === "self") continue;

        const isGroup = !!latest.groupId;
        const contactId = isGroup
          ? key
          : String(latest.chatPartnerId ?? latest.senderId ?? latest.receiverId ?? "");

        if (!contactId) continue;

        let contact = this.contacts.find((c) => String(c.id) === contactId);
        if (!contact) {
          const partner = latest.chatPartner || latest.sender || {};
          const groupMeta: GroupMetaFromLatest = isGroup
            ? resolveGroupMetaFromLatest(latest)
            : {
              groupNumber: "",
              tags: [],
              admin: [],
              owner: undefined,
              memberCount: 0,
              allowMemberInvite: true,
            };
          contact = {
            id: contactId,
            name:
              partner.name ||
              partner.nickname ||
              partner.username ||
              "未知联系人",
            avatar:
              partner.avatar ||
              "https://cube.elemecdn.com/9/c2/f0ee8a3c7c9638a54940382568c9dpng.png",
            lastMessage: "",
            lastMessageTime: "",
            unreadCount: 0,
            isOnline: false,
            messages: [],
            remark: "",
            isTop: false,
            isMuted: false,
            isGroup,
            groupMembers: [],
            joinMessages: [],
            groupNumber: isGroup ? groupMeta.groupNumber : undefined,
            tags: isGroup ? groupMeta.tags : undefined,
            admin: isGroup ? groupMeta.admin : undefined,
            owner: isGroup ? groupMeta.owner : undefined,
            memberCount: isGroup ? groupMeta.memberCount : undefined,
            allowMemberInvite: isGroup ? groupMeta.allowMemberInvite : undefined,
          };
          this.contacts.push(contact);
        } else if (isGroup) {
          const groupMeta = resolveGroupMetaFromLatest(latest);
          if (!contact.groupNumber && groupMeta.groupNumber) {
            contact.groupNumber = groupMeta.groupNumber;
          }
          if ((!contact.tags || contact.tags.length === 0) && groupMeta.tags?.length) {
            contact.tags = groupMeta.tags;
          }
          if ((!contact.admin || contact.admin.length === 0) && groupMeta.admin?.length) {
            contact.admin = groupMeta.admin;
          }
          if (!contact.owner && groupMeta.owner) {
            contact.owner = groupMeta.owner;
          }
          if (!contact.memberCount && groupMeta.memberCount) {
            contact.memberCount = groupMeta.memberCount;
          }
          if (contact.allowMemberInvite === undefined && groupMeta.allowMemberInvite !== undefined) {
            contact.allowMemberInvite = groupMeta.allowMemberInvite;
          }
        }
      }

      let hasUpdates = false;

      for (const contact of this.contacts) {
        contact.isTop = topMap.get(String(contact.id)) || false;
        contact.isMuted = muteMap.get(String(contact.id)) || false;

        const lookupKey = contact.isGroup
          ? String(contact.id)
          : [String(contact.id), this.currentUserId].sort().join("_");

        const latest = msgMap.get(lookupKey);
        if (latest) {
          const shouldReplaceSummary = shouldReplaceContactSummary(
            contact,
            latest.createdAt,
          );
          let enhancedSender = latest.sender;
          if (
            contact.isGroup &&
            latest.sender &&
            contact.groupMembers?.length
          ) {
            const member = contact.groupMembers.find(
              (m: any) => String(m.id) === String(latest.senderId),
            );
            if (member?.nickname) {
              enhancedSender = {
                ...latest.sender,
                groupNickname: member.nickname,
              };
            }
          }

          const newLastMessage = formatMessageContent(
            latest.messageType,
            latest.content,
            contact.isGroup,
            enhancedSender,
            latest.isRecalled || false,
            this.currentUserId,
            latest.senderId,
          );

          if (
            shouldReplaceSummary &&
            (contact.lastMessage !== newLastMessage ||
              contact.lastMessageTime !== latest.time ||
              contact.lastMessageAt !== latest.createdAt)
          ) {
            hasUpdates = true;
          }

          if (shouldReplaceSummary) {
            // 媒体消息聚合：列表摘要显示 [图片][图片][图片]，而不是单个 [图片]
            const mediaSummary = buildMediaSummaryText(contact.messages);
            contact.lastMessage = mediaSummary || newLastMessage;
            contact.lastMessageTime = latest.time;
            contact.lastMessageAt = latest.createdAt;
          }

          if (latest.unreadCount !== undefined) {
            contact.unreadCount = latest.unreadCount;
          }

          if (contact.isGroup && latest.sender) {
            contact.lastMessageSender = {
              nickname:
                enhancedSender?.groupNickname ||
                enhancedSender?.nickname ||
                "未知用户",
              id: String(latest.senderId),
            };
          }
        }
      }

      if (hasUpdates || this.contacts.length > 0) {
        sortContacts(this.contacts, this.currentUserId);
        this.notifyUpdate();
        console.log("[MessageLoader] 页面恢复可见，已同步最新消息");
      }
    } catch (error) {
      console.error("[MessageLoader] 同步最新消息失败:", error);
    }
  }

  /**
   * 处理 WebSocket 实时消息 - 核心修复
   */
  handleRealtimeMessage(data: any, type: "private" | "group"): Contact[] {
    try {
      const msg = data.message || data;
      const senderId = String(msg.senderId);
      const isMe = senderId === this.currentUserId;

      // 判断是否为群邀请类型
      const isGroupInviteType = msg.messageType && [
        GROUP_INVITE_TYPES.PENDING,
        GROUP_INVITE_TYPES.ACCEPTED,
        GROUP_INVITE_TYPES.REJECTED,
      ].includes(msg.messageType);

      const isGroup = !!msg.groupId || isGroupInviteType;

      // 解析群信息（群邀请时从 content 中提取）
      let groupInfo: { groupId: string; groupName: string; groupAvatar: string; tags: any[] } | null = null;

      if (isGroupInviteType && !msg.groupId) {
        try {
          const contentData = typeof msg.content === "string" ? JSON.parse(msg.content) : msg.content;
          if (contentData?.groupId) {
            groupInfo = {
              groupId: String(contentData.groupId),
              groupName: contentData.groupName || "未知群聊",
              groupAvatar: contentData.groupAvatar || "",
              tags: contentData.tags || [],
            };
          }
        } catch (err) {
          console.warn("解析群邀请内容失败:", err);
        }
      }

      // ==========================================
      // 1. 确定联系人ID
      // ==========================================
      let contactId: string;

      if (isGroup) {
        if (groupInfo?.groupId) {
          const gid = groupInfo.groupId;
          contactId = gid.startsWith("group_") ? gid : `group_${gid}`;
        } else if (msg.groupId) {
          const gid = String(msg.groupId);
          contactId = gid.startsWith("group_") ? gid : `group_${gid}`;
        } else {
          contactId = isMe ? String(msg.receiverId) : senderId;
        }
      } else {
        contactId = isMe ? String(msg.receiverId) : senderId;
      }

      // ==========================================
      // 2. 查找或创建联系人
      // ==========================================
      let contactIndex = this.contacts.findIndex((c) => c.id === contactId);
      let contact = contactIndex !== -1 ? this.contacts[contactIndex] : undefined;

      // 如果没有找到联系人，创建新联系人
      if (!contact) {
        if (isGroup) {
          // 创建群聊联系人
          const groupName = groupInfo?.groupName || msg.groupName || "未知群聊";
          const groupAvatar = groupInfo?.groupAvatar || msg.groupAvatar || "";

          contact = {
            id: contactId,
            name: groupName,
            avatar: groupAvatar,
            lastMessage: "",
            lastMessageTime: "",
            unreadCount: 0,
            isOnline: false,
            messages: [],
            remark: "",
            isTop: false,
            isMuted: false,
            isGroup: true,
            groupMembers: [],
            joinMessages: [],
            tags: groupInfo?.tags || [],
          };
          this.contacts.push(contact);
          contactIndex = this.contacts.length - 1;
          console.log("[MessageLoader] 创建新群聊联系人:", contactId, groupName);
        } else {
          // 创建私聊联系人
          const sender = msg.sender || {};
          contact = {
            id: contactId,
            name: sender.nickname || sender.username || "未知用户",
            avatar: sender.avatar || "https://cube.elemecdn.com/9/c2/f0ee8a3c7c9638a54940382568c9dpng.png",
            lastMessage: "",
            lastMessageTime: "",
            unreadCount: 0,
            isOnline: false,
            messages: [],
            remark: "",
            isTop: false,
            isMuted: false,
            isGroup: false,
            username: sender.username || "",
          };
          this.contacts.push(contact);
          contactIndex = this.contacts.length - 1;
          console.log("[MessageLoader] 创建新私聊联系人:", contactId);
        }
      }

      // 如果还是没有联系人，返回
      if (!contact) {
        return this.contacts;
      }

      // ==========================================
      // 3. 更新联系人信息
      // ==========================================

      // 使缓存失效
      invalidateChatHistoryCache(this.contacts, contactId);

      // 如果是群邀请，更新群名称和头像
      if (groupInfo) {
        contact.name = groupInfo.groupName;
        contact.avatar = groupInfo.groupAvatar;
        contact.tags = groupInfo.tags || [];
      }

      // 增强发送者信息
      let enhancedSender = msg.sender;
      if (isGroup && contact.groupMembers) {
        const member = contact.groupMembers.find(
          (m: any) => String(m.id) === String(msg.senderId),
        );
        if (member?.nickname) {
          enhancedSender = { ...msg.sender, groupNickname: member.nickname };
        }
      }

      // 更新最后一条消息
      const newLastMessage = formatMessageContent(
        msg.messageType || "text",
        msg.content,
        isGroup,
        enhancedSender,
        msg.isRecalled || false,
        this.currentUserId,
        msg.senderId,
      );

      contact.lastMessage = newLastMessage;
      contact.lastMessageTime = msg.time;
      contact.lastMessageAt = msg.createdAt || msg.time;

      // 更新未读数（不是自己发送的）
      if (!isMe) {
        const activeId = this.getActiveContactId();
        if (activeId !== contactId) {
          contact.unreadCount = (contact.unreadCount || 0) + 1;
        } else {
          // 正在看当前会话：实时推进后端已读游标（防抖），
          // 避免下次进入该会话时把「已看过的消息」再标记为「新消息」。
          this.scheduleAdvanceReadCursor(contactId);
        }
      }

      // 更新群昵称
      if (isGroup) {
        const nickname = getChatPartnerMyGroupNickname(msg.chatPartner);
        if (nickname) {
          contact.myGroupNickname = nickname;
        }
        if (enhancedSender) {
          contact.lastMessageSender = {
            nickname:
              enhancedSender.groupNickname ||
              enhancedSender.nickname ||
              "未知用户",
            id: senderId,
          };
        }
      }

      // ==========================================
      // 4. 添加消息到列表（去重）
      // ==========================================

      if (!Array.isArray(contact.messages)) {
        contact.messages = [];
      }

      const newMsg = {
        id: msg.id || `${Date.now()}_${Math.random()}`,
        content: msg.content,
        time: msg.time,
        createdAt: msg.createdAt || msg.time,
        _timestamp: msg.createdAt
          ? new Date(msg.createdAt).getTime()
          : undefined,
        avatar: enhancedSender?.avatar || "",
        isMe: isMe,
        senderId: senderId,
        senderName:
          enhancedSender?.groupNickname ||
          enhancedSender?.nickname ||
          enhancedSender?.username ||
          "未知用户",
        sender: enhancedSender,
        messageType: msg.messageType || "text",
        isRecalled: msg.isRecalled || false,
        recalledAt: msg.recalledAt || null,
        recalledContent: msg.recalledContent || null,
        // 群邀请相关
        groupId: isGroup ? contactId : undefined,
        receiverId: msg.receiverId,
        // 通话消息字段
        callType: msg.callType,
        callStatus: msg.callStatus,
        callDuration: msg.callDuration,
        // 引用回复字段
        replyTo: (msg as any).replyTo || undefined,
        // AI 深度思考（机器人回复默认开启，前端折叠展示）
        thinking: (msg as any).thinking || undefined,
        deepThinking: (msg as any).deepThinking === true,
        // AI 回复标记：前端据此做逐字打字机输出
        isBotMessage: (msg as any).isBotMessage === true || undefined,
      };

      // 检查是否已存在（去重）
      const exists = contact.messages.some((m: any) => {
        if (m.id && newMsg.id && String(m.id) === String(newMsg.id)) {
          return true;
        }
        if (
          typeof m.id === "string" &&
          m.id.startsWith("temp_") &&
          m.isMe &&
          newMsg.isMe &&
          m.content === newMsg.content &&
          m.messageType === newMsg.messageType
        ) {
          return true;
        }
        if (
          m.isMe &&
          newMsg.isMe &&
          m.messageType === newMsg.messageType &&
          m._timestamp &&
          newMsg._timestamp &&
          Math.abs(m._timestamp - newMsg._timestamp) < 3000
        ) {
          return true;
        }
        return false;
      });

      if (!exists) {
        contact.messages.push(newMsg);
        contact.messages.sort((a: any, b: any) => {
          const timeA = typeof a._timestamp === "number" && a._timestamp > 0
            ? a._timestamp
            : getMessageTimestamp(a.createdAt || a.time);
          const timeB = typeof b._timestamp === "number" && b._timestamp > 0
            ? b._timestamp
            : getMessageTimestamp(b.createdAt || b.time);
          return timeA - timeB;
        });

        // 🔥 强制换掉数组引用（原地 push 不会改变引用）：
        //   - MessageDisplay 的 displayMessages 计算属性依赖 activeContact.messages，
        //     引用不变就不会重算，界面要切换会话/页面才刷新；
        //   - RightChatArea 的「消息变化自动滚到底部」深度 watcher 同样不会触发；
        //   - 同时保证即使 MessageLoader 内部拿到的是原始数组，
        //     syncContactsInPlace 的 Object.assign 也能因引用变化而触发 Vue 更新。
        contact.messages = [...contact.messages];

        console.log("[MessageLoader] 添加新消息:", contactId, msg.messageType);
      }

      // 媒体消息聚合：一次发多张图 / 多个文件时，列表摘要显示 [图片][图片][图片]
      // （单条消息的 formatMessageContent 只返回一个图标，会被后一条覆盖）
      const mediaSummary = buildMediaSummaryText(contact.messages);
      if (mediaSummary) {
        contact.lastMessage = isGroup && enhancedSender
          ? `${enhancedSender.groupNickname || enhancedSender.nickname || enhancedSender.username || "未知用户"}: ${mediaSummary}`
          : mediaSummary;
      }

      // ==========================================
      // 5. 处理入群通知
      // ==========================================

      if (msg.messageType === "group_notification") {
        try {
          const content = typeof msg.content === "string" ? JSON.parse(msg.content) : msg.content;
          if (content.type === "group_notification" && content.joinedUser) {
            if (!contact.joinMessages) {
              contact.joinMessages = [];
            }
            const joinMessage = {
              userId: String(content.joinedUser.id),
              userName:
                content.joinedUser.nickname ||
                content.joinedUser.username ||
                "用户",
              time: msg.time || new Date().toISOString(),
            };
            const existsJoin = contact.joinMessages.some(
              (jm) =>
                jm.userId === joinMessage.userId &&
                Math.abs(
                  getMessageTimestamp(jm.time) -
                  getMessageTimestamp(joinMessage.time),
                ) < 1000,
            );
            if (!existsJoin) {
              contact.joinMessages.push(joinMessage);
              contact.joinMessages.sort(
                (a, b) => getMessageTimestamp(a.time) - getMessageTimestamp(b.time),
              );
            }
          }
        } catch (err) {
          // 静默失败
        }
      }

      // ==========================================
      // 6. 替换联系人对象（触发响应式更新）
      // ==========================================

      if (contactIndex !== -1) {
        this.contacts[contactIndex] = { ...contact };
      }

      // 重新排序
      sortContacts(this.contacts, this.currentUserId);

      // 强制更新整个数组（触发 Vue 响应式）
      const newContactsArray = [...this.contacts];
      this.contacts.splice(0, this.contacts.length, ...newContactsArray);

      // 通知更新
      this.notifyUpdate();

      // ==========================================
      // 7. 🔥 消息通知（声音、弹窗、状态栏、桌面通知、标题闪烁）
      // ==========================================
      if (!isMe) {
        this.handleNotifications(msg, contact, contactId);
      }

      console.log("[MessageLoader] 联系人已更新:", {
        contactId,
        messageType: msg.messageType,
        isMe,
        messageCount: contact.messages.length,
        contactsCount: this.contacts.length,
      });

      return this.contacts;
    } catch (err) {
      console.error("[MessageLoader] 处理实时消息失败:", err);
      return this.contacts;
    }
  }

  private getActiveContactId(): string {
    return this.activeContactId?.value || "";
  }

  /**
   * 实时推进已读游标（防抖）。
   * 用户正在看某会话时收到对方消息，推进后端游标到最新，
   * 避免下次进入该会话时把「已看过的消息」再标记为「新消息」。
   * 复用 mark-read 接口（它会更新已读状态 + 推进游标）。
   */
  private scheduleAdvanceReadCursor(contactId: string) {
    const existing = this.readCursorTimers.get(contactId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      this.readCursorTimers.delete(contactId);
      request
        .post(`/message/mark-read/${contactId}`)
        .catch(() => {
          /* 静默失败：实时推进失败不影响主流程，下次进入会话时 mark-read 兜底 */
        });
    }, 800);

    this.readCursorTimers.set(contactId, timer);
  }

  /**
   * 🔥 统一的消息通知处理
   * 根据 notificationMode 配置决定通知方式
   */
  private handleNotifications(msg: any, contact: Contact, contactId: string) {
    try {
      const notificationEnabled = localStorage.getItem("notificationEnabled") !== "false";
      if (!notificationEnabled) return;

      const notificationMode = localStorage.getItem("notificationMode") || "sound-and-system";
      if (notificationMode === "dnd") return; // 免打扰模式

      const notificationStore = useNotificationStore();
      const isActiveContact = this.getActiveContactId() === contactId;
      const isDocumentHidden = typeof document !== "undefined" && document.hidden;

      // 构建通知选项
      const options: MessagePageOptions = {
        contacts: this.contacts,
        activeContactId: this.activeContactId,
        currentUserId: this.currentUserId,
        router: this.router,
        notificationComponentRef: this.notificationComponentRef,
        statusBarNotificationRef: this.statusBarNotificationRef,
      };

      // 1. 声音提醒（除 statusbar-only 和 desktop-only 外都播放）
      if (!["statusbar-only", "desktop-only"].includes(notificationMode)) {
        notificationStore.playMessageSound();
      }

      // 2. 应用内弹窗通知
      if (["system-only", "sound-and-system"].includes(notificationMode)) {
        notificationStore.showCustomNotification(msg, contact, options);
      }

      // 3. 状态栏通知
      if (["statusbar-only", "sound-and-statusbar"].includes(notificationMode)) {
        notificationStore.showStatusBarNotification(msg, contact, options);
      }

      // 4. 桌面通知
      if (["desktop-only", "sound-and-desktop"].includes(notificationMode)) {
        notificationStore.showDesktopNotification(msg, contact, options);
      }

      // 5. 标题闪烁（仅当页面不在前台且不是当前活跃联系人时）
      if (!isActiveContact && isDocumentHidden) {
        notificationStore.startTitleFlash();
      }
    } catch (err) {
      console.error("[MessageLoader] 通知处理失败:", err);
    }
  }

  setActiveContactId(contactId: string) {
    const contact = this.contacts.find((c) => c.id === contactId);
    if (contact && contact.unreadCount && contact.unreadCount > 0) {
      contact.unreadCount = 0;
      this.notifyUpdate();
    }
  }

  getContacts(): Contact[] {
    return this.contacts;
  }

  setContacts(contacts: Contact[]) {
    this.contacts = contacts;
    this.notifyUpdate();
  }

  /**
   * 只同步数组引用，不回调（避免 setContacts 与本方法互相触发的死循环）。
   *
   * 🔥 关键：页面必须把「响应式的 contacts.value」交给这里。
   * 若传入的是原始数组（raw），后续实时消息的原地 push / 索引赋值都不会触发
   * Vue 依赖收集，表现为「机器人/对方回复要切换会话或页面才显示」。
   */
  setContactsReference(contacts: Contact[]) {
    this.contacts = contacts;
  }

  destroy() {
    if (this.refreshDebounceTimer) {
      clearTimeout(this.refreshDebounceTimer);
      this.refreshDebounceTimer = null;
    }
    this.readCursorTimers.forEach((timer) => clearTimeout(timer));
    this.readCursorTimers.clear();
    if (this.visibilityHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.updateCallbacks = [];
  }
}

// ==========================================
// 加载最近消息
// ==========================================

/**
 * /message/latest 响应短时缓存。
 * 首屏「快速加载」(自己+最近会话) 与随后的「后台补齐完整列表」会在极短时间内各调一次，
 * 缓存避免同一页面加载周期内重复请求；forceRefresh 可绕过缓存。
 */
let latestMessagesCache: { ts: number; data: any } | null = null;
const LATEST_MESSAGES_CACHE_TTL = 5000;

/** 清空「最近消息」短时缓存（登出 / 切换账号时调用，避免跨账号残留） */
export const clearLatestMessagesCache = (): void => {
  latestMessagesCache = null;
};

const fetchLatestMessages = async (forceRefresh = false): Promise<any> => {
  if (
    !forceRefresh &&
    latestMessagesCache &&
    Date.now() - latestMessagesCache.ts < LATEST_MESSAGES_CACHE_TTL
  ) {
    return latestMessagesCache.data;
  }
  // 🔥 forceRefresh 时同时绕过后端 /message/latest 的短时缓存（refresh=1），
  // 确保「切回页面强制刷新」拿到的是服务器最新数据，而非 5 秒内的旧缓存。
  const { data } = await request.get("/message/latest", {
    params: forceRefresh ? { refresh: 1 } : undefined,
  });
  latestMessagesCache = { ts: Date.now(), data };
  return data;
};

export const fetchAllRecentMessages = async (
  contacts: Contact[],
  currentUserId: string,
  options?: {
    forceRefresh?: boolean;
    onUpdate?: (contacts: Contact[]) => void;
  },
): Promise<Contact[]> => {
  const { forceRefresh = false, onUpdate } = options || {};

  if (typeof document !== "undefined" && document.hidden && !forceRefresh) {
    return contacts;
  }

  try {
    const data = await fetchLatestMessages(forceRefresh);
    // 🔥 兼容后端返回的多种格式：
    // 1. { recentMessages: [...] } - 直接是数组
    // 2. { recentMessages: { messages: [...] } } - 嵌套对象
    // 3. { messages: [...] } - 另一种格式
    let messages = data.recentMessages || data.messages || [];
    // 🔥 如果 recentMessages 是对象（包含 messages 属性），提取 messages 数组
    if (messages && typeof messages === "object" && !Array.isArray(messages) && Array.isArray(messages.messages)) {
      messages = messages.messages;
    }
    if (!Array.isArray(messages) || messages.length === 0) {
      return contacts;
    }

    const topMap = getTopStatusFromLocalStorage();
    const muteMap = getMuteStatusFromLocalStorage();
    ensureCurrentUserContact(contacts, currentUserId);
    const msgMap = new Map<string, any>();

    messages.forEach((m: any) => {
      const key = m.groupId
        ? String(m.groupId).startsWith("group_")
          ? String(m.groupId)
          : `group_${m.groupId}`
        : [String(m.senderId), String(m.receiverId)].sort().join("_");

      const existing = msgMap.get(key);
      if (
        !existing ||
        getMessageTimestamp(m.createdAt) > getMessageTimestamp(existing.createdAt)
      ) {
        msgMap.set(key, m);
      }
    });

    // 把 /message/latest 里出现的会话补进联系人列表（列表里没有的才创建），
    // 这样即使 contacts 只有「当前用户」，好友/群聊也能直接渲染出来。
    for (const [key, latest] of msgMap) {
      if (latest.chatType === "self") continue;

      const isGroup = !!latest.groupId;
      const contactId = isGroup
        ? key
        : String(latest.chatPartnerId ?? latest.senderId ?? latest.receiverId ?? "");

      if (!contactId) continue;

      if (!contacts.some((c) => String(c.id) === contactId)) {
        const partner = latest.chatPartner || latest.sender || {};
        contacts.push({
          id: contactId,
          name:
            partner.name ||
            partner.nickname ||
            partner.username ||
            "未知联系人",
          avatar:
            partner.avatar ||
            "https://cube.elemecdn.com/9/c2/f0ee8a3c7c9638a54940382568c9dpng.png",
          lastMessage: "",
          lastMessageTime: "",
          unreadCount: 0,
          isOnline: false,
          messages: [],
          remark: "",
          isTop: false,
          isMuted: false,
          isGroup,
          groupMembers: [],
          joinMessages: [],
        });
      }
    }

    let hasUpdates = false;

    for (const contact of contacts) {
      contact.isTop = topMap.get(String(contact.id)) || false;
      contact.isMuted = muteMap.get(String(contact.id)) || false;

      const lookupKey = contact.isGroup
        ? String(contact.id)
        : [String(contact.id), currentUserId].sort().join("_");

      const latest = msgMap.get(lookupKey);

      if (latest) {
        const shouldReplaceSummary = shouldReplaceContactSummary(
          contact,
          latest.createdAt,
        );
        let enhancedSender = latest.sender;
        if (contact.isGroup && latest.sender && contact.groupMembers?.length) {
          const member = contact.groupMembers.find(
            (m: any) => String(m.id) === String(latest.senderId),
          );
          if (member?.nickname) {
            enhancedSender = {
              ...latest.sender,
              groupNickname: member.nickname,
            };
          }
        }

        const newLastMessage = formatMessageContent(
          latest.messageType,
          latest.content,
          contact.isGroup,
          enhancedSender,
          latest.isRecalled || false,
          currentUserId,
          latest.senderId,
        );

        // 媒体消息聚合：列表摘要显示 [图片][图片][图片]，而不是单个 [图片]
        const mediaSummary = buildMediaSummaryText(contact.messages);
        const finalLastMessage = mediaSummary || newLastMessage;

        if (
          contact.lastMessage !== finalLastMessage ||
          contact.lastMessageTime !== latest.time
        ) {
          hasUpdates = true;
        }

        contact.lastMessage = finalLastMessage;
        contact.lastMessageTime = latest.time;
        // 记录可解析时间戳，供联系人列表按真实时间排序（lastMessageTime 是「今天 HH:mm」等中文展示串，无法排序）
        contact.lastMessageAt = latest.createdAt;

        if (latest.unreadCount !== undefined) {
          contact.unreadCount = latest.unreadCount;
        }

        if (contact.isGroup) {
          const nickname = getChatPartnerMyGroupNickname(latest.chatPartner);
          if (nickname) {
            contact.myGroupNickname = nickname;
          }
          if (latest.sender) {
            contact.lastMessageSender = {
              nickname:
                enhancedSender?.groupNickname ||
                enhancedSender?.nickname ||
                "未知用户",
              id: String(latest.senderId),
            };
          }
        }
      }
    }

    if (hasUpdates) {
      sortContacts(contacts, currentUserId);
      if (onUpdate) {
        onUpdate([...contacts]);
      }
    }

    return contacts;
  } catch (error) {
    console.error("加载最近消息失败:", error);
    return contacts;
  }
};

// ==========================================
// WebSocket 消息处理入口
// ==========================================

export interface HandleRealtimeMessageOptions {
  contacts: Contact[];
  currentUserId: string;
  activeContactId: string;
  rightChatAreaRef?: any;
  nextTick?: (fn: () => void) => void;
  notificationComponentRef?: any;
  statusBarNotificationRef?: any;
  router?: any;
  messageLoader?: MessageLoader;
}

/**
 * 处理实时消息 - 统一入口
 */
export const handleRealtimeMessage = (
  data: any,
  type: "private" | "group",
  options: HandleRealtimeMessageOptions,
) => {
  // 优先使用 MessageLoader
  if (options.messageLoader) {
    return options.messageLoader.handleRealtimeMessage(data, type);
  }

  // 降级处理
  return handleRealtimeMessageLegacy(data, type, options);
};

/**
 * 降级处理函数（兼容旧逻辑）
 */
const handleRealtimeMessageLegacy = (
  data: any,
  type: "private" | "group",
  options: HandleRealtimeMessageOptions,
) => {
  const {
    contacts,
    currentUserId,
    activeContactId,
    rightChatAreaRef,
    nextTick,
    notificationComponentRef,
    statusBarNotificationRef,
    router,
  } = options;

  try {
    const msg = data.message || data;
    const senderId = String(msg.senderId);
    const isMe = senderId === currentUserId;

    const isGroupInviteType = msg.messageType && [
      GROUP_INVITE_TYPES.PENDING,
      GROUP_INVITE_TYPES.ACCEPTED,
      GROUP_INVITE_TYPES.REJECTED,
    ].includes(msg.messageType);

    const isGroup = !!msg.groupId || isGroupInviteType;

    // 解析群信息
    let groupInfo: { groupId: string; groupName: string; groupAvatar: string; tags: any[] } | null = null;

    if (isGroupInviteType && !msg.groupId) {
      try {
        const contentData = typeof msg.content === "string" ? JSON.parse(msg.content) : msg.content;
        if (contentData?.groupId) {
          groupInfo = {
            groupId: String(contentData.groupId),
            groupName: contentData.groupName || "未知群聊",
            groupAvatar: contentData.groupAvatar || "",
            tags: contentData.tags || [],
          };
        }
      } catch (err) {
        console.warn("解析群邀请内容失败:", err);
      }
    }

    // 确定联系人ID
    let contactId: string;

    if (isGroup) {
      if (groupInfo?.groupId) {
        const gid = groupInfo.groupId;
        contactId = gid.startsWith("group_") ? gid : `group_${gid}`;
      } else if (msg.groupId) {
        const gid = String(msg.groupId);
        contactId = gid.startsWith("group_") ? gid : `group_${gid}`;
      } else {
        contactId = isMe ? String(msg.receiverId) : senderId;
      }
    } else {
      contactId = isMe ? String(msg.receiverId) : senderId;
    }

    // 查找或创建联系人
    let contactIndex = contacts.findIndex((c) => c.id === contactId);
    let contact = contactIndex !== -1 ? contacts[contactIndex] : undefined;

    if (!contact) {
      if (isGroup) {
        const groupName = groupInfo?.groupName || msg.groupName || "未知群聊";
        const groupAvatar = groupInfo?.groupAvatar || msg.groupAvatar || "";

        contact = {
          id: contactId,
          name: groupName,
          avatar: groupAvatar,
          lastMessage: "",
          lastMessageTime: "",
          unreadCount: 0,
          isOnline: false,
          messages: [],
          remark: "",
          isTop: false,
          isMuted: false,
          isGroup: true,
          groupMembers: [],
          joinMessages: [],
          tags: groupInfo?.tags || [],
        };
        contacts.push(contact);
        contactIndex = contacts.length - 1;
      } else {
        const sender = msg.sender || {};
        contact = {
          id: contactId,
          name: sender.nickname || sender.username || "未知用户",
          avatar: sender.avatar || "https://cube.elemecdn.com/9/c2/f0ee8a3c7c9638a54940382568c9dpng.png",
          lastMessage: "",
          lastMessageTime: "",
          unreadCount: 0,
          isOnline: false,
          messages: [],
          remark: "",
          isTop: false,
          isMuted: false,
          isGroup: false,
          username: sender.username || "",
        };
        contacts.push(contact);
        contactIndex = contacts.length - 1;
      }
    }

    if (!contact) {
      return contacts;
    }

    // 更新联系人信息
    invalidateChatHistoryCache(contacts, contactId);

    if (groupInfo) {
      contact.name = groupInfo.groupName;
      contact.avatar = groupInfo.groupAvatar;
      contact.tags = groupInfo.tags || [];
    }

    // 增强发送者
    let enhancedSender = msg.sender;
    if (isGroup && contact.groupMembers) {
      const member = contact.groupMembers.find(
        (m: any) => String(m.id) === String(msg.senderId),
      );
      if (member?.nickname) {
        enhancedSender = { ...msg.sender, groupNickname: member.nickname };
      }
    }

    // 更新最后消息
    const newLastMessage = formatMessageContent(
      msg.messageType || "text",
      msg.content,
      isGroup,
      enhancedSender,
      msg.isRecalled || false,
      currentUserId,
      msg.senderId,
    );

    contact.lastMessage = newLastMessage;
    contact.lastMessageTime = msg.time;
    contact.lastMessageAt = msg.createdAt || msg.time;

    if (!isMe) {
      if (activeContactId !== contactId) {
        contact.unreadCount = (contact.unreadCount || 0) + 1;
      }
    }

    if (isGroup) {
      const nickname = getChatPartnerMyGroupNickname(msg.chatPartner);
      if (nickname) {
        contact.myGroupNickname = nickname;
      }
      if (enhancedSender) {
        contact.lastMessageSender = {
          nickname: enhancedSender.groupNickname || enhancedSender.nickname || "未知用户",
          id: senderId,
        };
      }
    }

    // 添加消息
    if (!Array.isArray(contact.messages)) {
      contact.messages = [];
    }

    const newMsg = {
      id: msg.id || `${Date.now()}_${Math.random()}`,
      content: msg.content,
      time: msg.time,
      createdAt: msg.createdAt || msg.time,
      _timestamp: msg.createdAt ? new Date(msg.createdAt).getTime() : undefined,
      avatar: enhancedSender?.avatar || "",
      isMe: isMe,
      senderId: senderId,
      senderName: enhancedSender?.groupNickname || enhancedSender?.nickname || enhancedSender?.username || "未知用户",
      sender: enhancedSender,
      messageType: msg.messageType || "text",
      isRecalled: msg.isRecalled || false,
      recalledAt: msg.recalledAt || null,
      recalledContent: msg.recalledContent || null,
      groupId: isGroup ? contactId : undefined,
      receiverId: msg.receiverId,
      // 通话消息字段
      callType: msg.callType,
      callStatus: msg.callStatus,
      callDuration: msg.callDuration,
      // 引用回复字段
      replyTo: (msg as any).replyTo || undefined,
    };

    const exists = contact.messages.some((m: any) => {
      if (m.id && newMsg.id && String(m.id) === String(newMsg.id)) return true;
      if (typeof m.id === "string" && m.id.startsWith("temp_") && m.isMe && newMsg.isMe &&
        m.content === newMsg.content && m.messageType === newMsg.messageType) return true;
      if (m.isMe && newMsg.isMe && m.messageType === newMsg.messageType &&
        m._timestamp && newMsg._timestamp && Math.abs(m._timestamp - newMsg._timestamp) < 3000) return true;
      return false;
    });

    if (!exists) {
      contact.messages.push(newMsg);
      contact.messages.sort((a: any, b: any) => {
        const timeA = typeof a._timestamp === "number" && a._timestamp > 0
          ? a._timestamp
          : getMessageTimestamp(a.createdAt || a.time);
        const timeB = typeof b._timestamp === "number" && b._timestamp > 0
          ? b._timestamp
          : getMessageTimestamp(b.createdAt || b.time);
        return timeA - timeB;
      });
      // 同上：换引用以触发界面重算 + 自动滚动
      contact.messages = [...contact.messages];
    }

    // 媒体消息聚合：一次发多张图 / 多个文件时，列表摘要显示 [图片][图片][图片]
    const mediaSummary = buildMediaSummaryText(contact.messages);
    if (mediaSummary) {
      contact.lastMessage = isGroup && enhancedSender
        ? `${enhancedSender.groupNickname || enhancedSender.nickname || enhancedSender.username || "未知用户"}: ${mediaSummary}`
        : mediaSummary;
    }

    // 更新联系人
    if (contactIndex !== -1) {
      contacts[contactIndex] = { ...contact };
    }

    // 重新排序
    sortContacts(contacts, currentUserId);

    // 强制更新响应式
    const newContactsArray = [...contacts];
    contacts.splice(0, contacts.length, ...newContactsArray);

    // 滚动到底部
    if (activeContactId === contactId && rightChatAreaRef?.value?.scrollToBottom && nextTick) {
      nextTick(() => {
        rightChatAreaRef.value.scrollToBottom();
      });
    }

    // 通知
    if (!isMe && localStorage.getItem("notificationEnabled") !== "false") {
      const notificationStore = useNotificationStore();
      if (localStorage.getItem("notificationMode") !== "dnd") {
        notificationStore.playMessageSound();
      }
      if (activeContactId !== contactId) {
        if (typeof document !== "undefined" && document.hidden) {
          notificationStore.startTitleFlash();
        }
      }
    }

    console.log("[handleRealtimeMessage] 消息处理完成:", {
      contactId,
      messageType: msg.messageType,
      isMe,
      contactsCount: contacts.length,
    });

    return contacts;
  } catch (err) {
    console.error("处理实时消息失败", err);
    return options.contacts;
  }
};

// ==========================================
// 撤回消息处理
// ==========================================

export const handleRecallMessage = (data: any, state: MessagePageState) => {
  try {
    const { messageId, groupId, receiverId, senderId, time } = data;
    const isGroup = !!groupId;
    const cid = isGroup
      ? `group_${groupId}`
      : String(senderId) === state.currentUserId
        ? String(receiverId)
        : String(senderId);
    // id 可能是 number / string，统一按字符串比较，避免撤回事件静默失效
    const c = state.contacts.find((x) => String(x.id) === String(cid));
    if (!c) return;

    const idx = c.messages.findIndex((x) => String(x.id) === String(messageId));
    if (idx !== -1) {
      const m = c.messages[idx];
      if (!m.recalledContent && m.content) m.recalledContent = m.content;
      m.content = "";
      m.isRecalled = true;
      m.recalledAt = time || new Date().toISOString();
      c.messages = [...c.messages];
    }

    updateContactLastMessageAfterRecall(c, state.currentUserId);
    state.contacts.splice(0, state.contacts.length, ...state.contacts);
  } catch { }
};

const updateContactLastMessageAfterRecall = (c: Contact, uid: string) => {
  if (!c.messages?.length) {
    c.lastMessage = "暂无消息";
    c.lastMessageTime = "";
    return;
  }
  // 撤回后直接取当前最后一条消息：若它就是刚被撤回的消息，formatMessageContent 会
  // 按 isRecalled 返回「你撤回了一条消息 / 对方撤回了一条消息」，与聊天界面保持一致；
  // 若撤回的不是最后一条，则仍显示原有的最后一条普通消息内容。
  const last = c.messages[c.messages.length - 1];
  c.lastMessage = formatMessageContent(
    last.messageType || "text",
    last.content,
    c.isGroup,
    last.sender,
    last.isRecalled || false,
    uid,
    last.senderId,
  );
  c.lastMessageTime = last.time;
};

// ==========================================
// 其他工具函数
// ==========================================

export const prepareTemporaryChat = async (userId: number | string) => {
  const userStore = await import("../stores/user").then((m) =>
    m.useUserStore(),
  );
  const { checkFriendship } = await import("./friendManager");

  try {
    const userResponse = await request.get(`/users/${userId}`);
    const userInfo = userResponse.data;

    const isFriend = await checkFriendship(Number(userId));

    if (!isFriend) {
      const { createOrUpdateTemporaryContactAPI } =
        await import("./contactManager");
      const success = await createOrUpdateTemporaryContactAPI(
        String(userId),
        userInfo.nickname || userInfo.username || "未知用户",
        userInfo.avatar ||
        "https://cube.elemecdn.com/9/c2/f0ee8a3c7c9638a54940382568c9dpng.png",
        userInfo.username || "",
      );

      if (!success) {
        throw new Error("创建临时会话失败");
      }
    }

    return {
      id: Number(userId),
      name: userInfo.nickname || userInfo.username || "未知用户",
      avatar:
        userInfo.avatar ||
        "https://cube.elemecdn.com/9/c2/f0ee8a3c7c9638a54940382568c9dpng.png",
      username: userInfo.username,
      isOnline: userInfo.status === 0,
      isFriend,
      userInfo,
    };
  } catch (error: any) {
    throw error;
  }
};

export const handleDeleteMessageFromWs = (
  data: any,
  state: MessagePageState,
) => {
  try {
    const { messageId, groupId, receiverId, senderId } = data;
    const isGroup = !!groupId;
    const cid = isGroup
      ? `group_${groupId}`
      : String(senderId) === state.currentUserId
        ? String(receiverId)
        : String(senderId);
    const c = state.contacts.find((x) => x.id === cid);
    if (!c) return;
    const idx = c.messages.findIndex((x) => x.id === messageId);
    if (idx === -1) return;
    c.messages.splice(idx, 1);

    if (c.messages.length) {
      const last = c.messages.at(-1)!;
      const text = formatMessageContent(
        last.messageType || "text",
        last.content,
        c.isGroup,
        last.sender,
        last.isRecalled,
        state.currentUserId,
        last.senderId,
      );
      updateContactLastMessage(
        state.contacts,
        cid,
        text,
        last.time || new Date().toISOString(),
      );
    } else {
      updateContactLastMessage(state.contacts, cid, "", "");
    }
    state.contacts.splice(0, state.contacts.length, ...state.contacts);
  } catch { }
};

export const handleBatchDeleteMessagesFromWs = (
  data: any,
  state: MessagePageState,
) => {
  try {
    const { messageIds, groupId } = data;
    if (!messageIds?.length) return;
    const cid = `group_${groupId}`;
    const c = state.contacts.find((x) => x.id === cid);
    if (!c) return;
    const set = new Set(messageIds.map(String));
    c.messages = c.messages.filter((x) => !set.has(String(x.id)));

    if (c.messages.length) {
      const last = c.messages.at(-1)!;
      const text = formatMessageContent(
        last.messageType || "text",
        last.content,
        c.isGroup,
        last.sender,
        last.isRecalled,
        state.currentUserId,
        last.senderId,
      );
      updateContactLastMessage(
        state.contacts,
        cid,
        text,
        last.time || new Date().toISOString(),
      );
    } else {
      updateContactLastMessage(state.contacts, cid, "", "");
    }
    state.contacts.splice(0, state.contacts.length, ...state.contacts);
  } catch { }
};

export const handleGroupMemberLevelUpdate = (
  data: any,
  state: MessagePageState,
  active: string,
) => {
  try {
    const { userId, groupId, chatLevel, messageCount } = data;
    const cid = `group_${groupId}`;
    const c = state.contacts.find((x) => x.id === cid);
    if (!c?.isGroup || !c.groupMembers) return;
    const idx = c.groupMembers.findIndex(
      (x) => String(x.id) === String(userId),
    );
    if (idx === -1) return;
    c.groupMembers[idx].chatLevel = chatLevel;
    if (messageCount !== undefined) {
      c.groupMembers[idx].messageCount = messageCount;
    }
    c.groupMembers = [...c.groupMembers];
    state.contacts.splice(0, state.contacts.length, ...state.contacts);
  } catch { }
};

export const handleGroupMemberTitleUpdate = (
  data: any,
  state: MessagePageState,
  active: string,
) => {
  try {
    const { userId, groupId, groupTitle, useDefaultTitle } = data;
    const cid = `group_${groupId}`;
    const c = state.contacts.find((x) => x.id === cid);
    if (!c?.isGroup || !c.groupMembers) return;
    const idx = c.groupMembers.findIndex(
      (x) => String(x.id) === String(userId),
    );
    if (idx === -1) return;
    c.groupMembers[idx].groupTitle = groupTitle;
    c.groupMembers[idx].useDefaultTitle = useDefaultTitle ?? false;
    c.groupMembers = [...c.groupMembers];
    state.contacts.splice(0, state.contacts.length, ...state.contacts);
  } catch { }
};

export const fetchGroupDetails = async (gid: string, contacts: Contact[]) => {
  try {
    const data = await fetchGroupDetail(gid);
    const c = contacts.find((x) => x.id === gid);
    if (!c?.isGroup) return;

    const groupMembers = Array.isArray(data.members) ? data.members : [];
    const derivedAdmins =
      Array.isArray(data.admin) && data.admin.length > 0
        ? data.admin
        : groupMembers
          .filter((member: any) => String(member?.role || "").toLowerCase() === "admin")
          .map((member: any) => ({
            id: member.id ?? member.userId ?? member.user?.id,
            name: member.name ?? member.nickname ?? member.username ?? "管理员",
            avatar: member.avatar,
            role: "admin",
          }));

    c.owner = data.owner;
    c.admin = derivedAdmins;
    c.groupOwnerId = data.owner ? String(data.owner.id) : "";
    c.groupRule = data.rule;
    c.groupMembers =
      groupMembers.map((m: any) => ({
        id: String(m.id ?? m.userId ?? m.user?.id ?? ""),
        userId: String(m.id ?? m.userId ?? m.user?.id ?? ""),
        name: m.name,
        avatar: m.avatar,
        role: m.role,
        joinTime: m.joinTime,
        nickname: m.nickname,
        tags: m.tags || [],
        chatLevel: m.chatLevel || 1,
        messageCount: m.messageCount || 0,
        groupTitle: m.groupTitle,
        useDefaultTitle: m.useDefaultTitle ?? false,
        isBot: m.isBot === true || undefined,
      })) || [];
  } catch { }
};