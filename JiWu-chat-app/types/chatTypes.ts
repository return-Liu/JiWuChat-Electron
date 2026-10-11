// types/chatTypes.ts

export interface ChatMessage {
  id?: string | number;
  content: string;
  time: string;
  isMe: boolean;
  senderId?: string | number;
  senderName?: string;
  sender?: {
    avatar?: string;
    nickname?: string;
    username?: string;
    id?: string | number;
    groupNickname?: string;
  };
  createdAt?: string;
  messageType: string;
  _timestamp?: number;
  _formattedTime?: string;
  _uniqueId?: string;
  status?: string;
  // 撤回相关
  isRecalled?: boolean;
  recalledAt?: string;
  recalledBy?: string;
  recalledContent?: string;
  // 引用回复相关
  replyTo?: {
    messageId?: string | number;
    senderName?: string;
    content?: string;
    messageType?: string;
  };
  // 文件相关
  fileName?: string;
  fileSize?: number;
  // 通话相关
  callType?: "audio" | "video";
  callStatus?: "missed" | "cancelled" | "ended" | "rejected";
  callDuration?: number;
  // 系统消息相关
  groupId?: string | number | null;
  receiverId?: string | number;
  // AI 深度思考（机器人回复默认开启，前端折叠展示）
  thinking?: string;
  deepThinking?: boolean;
  /** 是否为 AI 机器人回复（后端标记，前端据此做逐字打字机输出） */
  isBotMessage?: boolean;
}

export interface Contact {
  id: string | number;
  name: string;
  avatar: string;
  remark?: string;
  isOnline: boolean;
  messages: ChatMessage[];
  isTop?: boolean;
  isMuted?: boolean;
  isDefault?: boolean;
  isGroup: boolean;
  isFriend?: boolean;
  /** 是否为机器人（AI 助手）：机器人会话隐藏语音/视频通话等能力 */
  isBot?: boolean;
  /** 是否为「当前用户自己」的会话（始终排在列表首位） */
  isSelf?: boolean;
  groupOwnerId?: string;
  groupMembers?: {
    id: string | number;
    name: string;
    avatar: string;
    nickname?: string;
    tags?: string[];
    isMuted?: boolean;
    isOnline?: boolean;
    chatLevel?: number;
    messageCount?: number;
    groupTitle?: string;
    useDefaultTitle?: boolean;
    role?: string;
    /** 是否为 AI 机器人成员（后端 groupmembers 里 isBotId 标记），用于 @ 列表/成员列表显示徽标 */
    isBot?: boolean;
  }[];
  memberCount?: number;
  /** @deprecated 由前端从聊天消息里反解，后续统一用 joinNotices */
  joinMessages?: { userId: string; userName: string; time: string }[];
  /**
   * 入群通知（后端群详情接口 `joinNotices` 字段，权威数据源）。
   * 每有人入群追加一条，包含该群全部历史入群记录。
   */
  joinNotices?: {
    id?: number | string;
    userId: string;
    userName: string;
    userAvatar?: string;
    operatorId?: string | null;
    operatorName?: string | null;
    source?: "invite" | "application" | "public" | "create" | string;
    memberCount?: number | null;
    message?: string;
    /** 可解析时间（ISO），用于排序 / 去重 */
    joinedAt?: string;
    /** 展示用时间，如「今天 11:02」 */
    time?: string;
  }[];
  groupRule?: string;
  groupNumber?: string;
  owner?: { id: string; name: string; avatar: string; nickname?: string };
  admin?: { id: string; name: string; avatar: string; nickname?: string }[];
  createdAt?: string;
  lastMessage: string;
  lastMessageTime: string;
  lastMessageAt?: string;
  /** 已读游标：该会话「读到的最后一条消息 id」（后端 conversation_reads，全局自增，id > 该值即为新消息） */
  readCursor?: number;
  unreadCount: number;
  role?: string;
  originalIndex?: number;
  lastMessageSender?: {
    nickname: string;
    id: string;
  };
  username?: string;
  myGroupNickname?: string;
  myGroupTags?: string[];
  tags?: string[];
  blocked?: boolean;
  muteAll?: boolean;
  allowMemberInvite?: boolean;
  onlineVisibility?: number;
  status?: number;
  /**
   * 群聊风险等级（QQ 式安全提醒，仅用于展示提示，不影响消息收发）。
   * normal-正常，watch-关注，warning-存在风险，high-较高风险，severe-严重风险
   */
  riskLevel?: "normal" | "watch" | "warning" | "high" | "severe";
  /** 近 30 天去重举报人数 */
  riskReportCount?: number;
  /** 举报原因分布（中文描述） */
  riskReasons?: string[];
  chatHistoryPagination?: {
    currentPage: number;
    totalPages: number;
    total: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface UserInfo {
  avatar: string;
  username?: string;
}

export interface ColorPalette {
  name: string;
  color: string;
  hover: string;
  active: string;
  light: string;
  text: string;
}

export interface SelectedImage {
  id: string;
  file: File;
  previewUrl: string;
  tempFilename?: string;
  mediaType: "image";
  isScreenshot?: boolean;
}

export interface SelectedVideo {
  id: string;
  file: File;
  previewUrl?: string;
  duration?: number;
  tempFilename?: string;
  mediaType: "video";
}

export interface ImageHandlerOptions {
  selectedMedias: { value: SelectedImage[] };
  lastMediaSelectionTime: { value: number | null };
  activeContact: { value: Contact | undefined };
  showMediaPreview: { value: boolean };
  previewMedias: { value: (string | { url: string; type: string })[] };
  currentPreviewIndex: { value: number };
  lastRemoveMediaTime?: { value: number | null };
}

export interface VideoHandlerOptions {
  selectedMedias: { value: SelectedVideo[] };
  lastMediaSelectionTime: { value: number | null };
  activeContact: { value: Contact | undefined };
  showMediaPreview: { value: boolean };
  previewMedias: { value: (string | { url: string; type: string })[] };
  currentPreviewIndex: { value: number };
  lastRemoveMediaTime?: { value: number | null };
}

export interface ContactManagerOptions {
  contacts: Contact[];
  activeContactId: string | number;
  currentUserId: string;
  newMessage?: { value: string };
  isTop?: { value: boolean };
  isMuted?: { value: boolean };
  showContactDrawer?: { value: boolean };
  isEditingRule?: { value: boolean };
  tempGroupRule?: { value: string };
  defaultGroupRule?: { value: string };
  showAllMembers?: { value: boolean };
  tempRemark?: { value: string };
  remarkEditableRef?: { value: HTMLElement | null };
  activeContact?: { value: Contact | undefined };
  emit?: (event: string, ...args: any[]) => void;
  handleInputLocal?: (e: InputEvent) => void;
}

export type SendMessageFunction = (
  contactId: string | number,
  message: string,
  options: ContactManagerOptions,
  userStore: any,
  messageType?: string,
  files?: File[],
  tempFilenames?: string[],
) => Promise<void>;

// 系统消息类型常量
export const SYSTEM_MESSAGE_TYPES = {
  PENDING: 'group_invite_pending',
  ACCEPTED: 'group_invite_accepted',
  REJECTED: 'group_invite_rejected',
  NOTIFICATION: 'group_notification',
} as const;

export type SystemMessageType = typeof SYSTEM_MESSAGE_TYPES[keyof typeof SYSTEM_MESSAGE_TYPES];

//  判断是否为系统消息
export const isSystemMessageType = (messageType: string): boolean => {
  return Object.values(SYSTEM_MESSAGE_TYPES).includes(messageType as SystemMessageType);
};