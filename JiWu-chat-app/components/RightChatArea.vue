<template>
  <div class="qq-chat-area" v-if="activeContact" :style="chatAreaStyle" translate="no">
    <ChatHeader
      :activeContact="activeContact"
      :chatHeaderStyle="chatHeaderStyle"
      :currentColorPalette="currentColorPalette"
      :hideMenuButton="props.readonly"
      :isTyping="isTyping"
      :botThinking="botThinking"
      @navigate-to-edit="navigateToEdit"
      @toggle-drawer="showContactDrawer = !showContactDrawer"
      @refresh-contacts="emit('refreshContacts')"
    />

    <!-- 群聊风险提示横幅（QQ 式安全提醒，仅提示不拦截，用户可关闭） -->
    <div v-if="showRiskBanner" class="group-risk-banner" :class="riskBannerLevel">
      <WarningFilled class="risk-banner-icon" />
      <span class="risk-banner-text">{{ riskBannerText }}</span>
      <button class="risk-banner-link" type="button" @click="showRiskDetail = true">
        了解详情
      </button>
      <button class="risk-banner-close" type="button" title="不再提示" @click="dismissRiskBanner">
        <CloseOutlined />
      </button>
    </div>

    <!-- 群聊风险详情弹窗 -->
    <GroupRiskModal
      :visible="showRiskDetail"
      :group-name="activeContact?.name || ''"
      :risk-level="activeContact?.riskLevel || 'normal'"
      :report-count="activeContact?.riskReportCount || 0"
      :reasons="activeContact?.riskReasons || []"
      @update:visible="showRiskDetail = $event"
    />

    <!-- 搜索面板 -->
    <SearchPanel
      :showSearchPanel="showSearchPanel"
      :inputAreaStyle="inputAreaStyle"
      :searchKeyword="searchKeyword"
      :isSearching="isSearching"
      :hasSearched="hasSearched"
      :searchResults="searchResults"
      :activeContact="activeContact"
      :pageSize="pageSize"
      :currentSearchPage="currentSearchPage"
      @close-search-panel="closeSearchPanel"
      @clear-search="clearSearch"
      @perform-search="performSearch"
      @clear-search-results="clearSearchResults"
      @scroll-to-message="scrollToMessage"
      @navigate-to-user-info="navigateToUserInfo"
      @update:currentSearchPage="handlePageChange"
      @update:searchKeyword="searchKeyword = $event"
    />

    <!-- 主内容区域 -->
    <div class="main-content-area" @click="handleMainAreaClick">
      <div class="chat-content-wrapper" :class="{ 'with-search': showSearchPanel }">
        <MessageDisplay
          :active-contact="activeContact"
          :show-join-group-notice="!!showJoinGroupNotice"
          :join-message-display-text="joinMessageDisplayText || ''"
          :join-new-members="joinNewMembers"
          :is-self-chat="isSelfChat"
          :search-keyword="searchKeyword"
          :contacts="contacts"
          :current-user-id="Number(props.currentUserId)"
          :is-multi-select-mode="isMultiSelectMode"
          :chat-loading="props.chatLoading"
          @preview-image="previewImageLocal"
          @preview-video="previewVideoLocal"
          @play-video-on-hover="playVideoOnHover"
          @pause-video-on-leave="pauseVideoOnLeave"
          @add-friend="handleAddFriendFromProfile"
          @send-message="handleSendMessageFromProfile"
          @report="handleReportFromProfile"
          @refresh-messages="refreshChatHistory"
          @refresh-contacts="(forceRefresh) => emit('refreshContacts', forceRefresh)"
          @re-edit-message="handleReEditMessage"
          @re-edit-image="handleReEditImage"
          @re-edit-video="handleReEditVideo"
          @toggle-multi-select-mode="handleToggleMultiSelectMode"
          @file-click="handleFileMessageClick"
          @redial-call="handleRedialCall"
          @context-menu-show="handleContextMenuShow"
          @context-menu-close="closeContextMenu"
          @delete-message="handleMessageDelete"
          @recall-message="handleMessageRecall"
          @copy-message="handleMessageCopy"
          @reply-message="handleMessageReply"
          @forward-message="handleMessageForward"
          @multi-select-message="handleMultiSelectMessage"
          @retry-send-message="handleRetrySendMessage"
          @mention-user="handleMentionUser"
          @forward-messages="handleForwardMessages"
          ref="messageDisplayRef"
        />
      </div>
      <ContactDrawer
        :key="activeContact ? String(activeContact.id) : 'empty-contact'"
        :visible="showContactDrawer"
        @update:visible="showContactDrawer = $event"
        :contact="activeContact"
        :current-user-id="props.currentUserId"
        :color-palette="currentColorPalette"
        :is-group-owner="isCurrentUserGroupOwner"
        :is-group-admin="isCurrentUserGroupOrAdmin"
        @edit-remark="emitEditRemark"
        @clear-chat="handleClearChatLocal"
        @delete-friend="handleDeleteFriendLocal"
        @toggle-top="handleTopToggleLocal"
        @toggle-mute="handleMuteToggleLocal"
        @quit-group="handleQuitGroupLocal"
        @dissolve-group="handleDissolveGroupLocal"
        @update-group-rule="handleUpdateGroupRuleLocal"
        @navigate-to-edit="navigateToEdit"
        @toggle-search-panel="toggleSearchPanel"
        @refresh-contacts="emit('refreshContacts')"
        @update-contact="handleUpdateContactFromDrawer"
        @send-message="handleSendMessageFromProfile"
        @delete-temporary-contact="handleDeleteTemporaryContactLocal"
      />

      <!-- 临时图片预览组件 -->
      <MediaPreview
        v-if="selectedImages.length > 0"
        :visible="showTempImagePreview"
        :image="selectedImages"
        :currentMediaIndex="currentTempPreviewIndex"
        :isTempMedia="true"
        @close="closeTempImagePreview"
        @update:currentMediaIndex="currentTempPreviewIndex = $event"
        @delete-media="handleDeleteTempImage"
      />

      <!-- 临时视频预览组件 -->
      <MediaPreview
        v-if="selectedVideos.length > 0"
        :visible="showTempVideoPreview"
        :image="selectedVideos"
        :currentMediaIndex="currentTempVideoPreviewIndex"
        :isTempMedia="true"
        @close="closeTempVideoPreview"
        @update:currentMediaIndex="currentTempVideoPreviewIndex = $event"
        @delete-media="handleDeleteTempVideo"
      />

      <!-- 临时文件预览组件 -->
      <FilePreview
        v-if="selectedFiles.length > 0"
        :visible="showTempFilePreview"
        :file="currentPreviewFile"
        :fileList="selectedFiles"
        :currentIndex="currentTempFilePreviewIndex"
        @close="closeTempFilePreview"
        @update:currentIndex="currentTempFilePreviewIndex = $event"
        @delete-file="handleDeleteTempFile"
      />

      <!-- 图片预览组件 -->
      <MediaPreview
        v-if="previewImages && previewImages.length > 0"
        :visible="showImagePreview"
        :image="previewImages"
        :currentMediaIndex="currentPreviewIndex"
        :groupName="activeContact?.isGroup ? activeContact.name : ''"
        @close="closeImagePreviewLocal"
        @update:currentMediaIndex="currentPreviewIndex = $event"
      />

      <!-- 视频预览组件 -->
      <MediaPreview
        v-if="previewVideos && previewVideos.length > 0"
        :visible="showVideoPreview"
        :image="previewVideos"
        :currentMediaIndex="currentVideoPreviewIndex"
        :groupName="activeContact?.isGroup ? activeContact.name : ''"
        @close="closeVideoPreviewLocal"
        @update:currentMediaIndex="currentVideoPreviewIndex = $event"
      />

      <!-- 消息输入区域组件 -->
      <MessageInputArea
        ref="messageInputAreaRef"
        :readonly="props.readonly"
        :is-blocked="isBlocked"
        :i-blocked-them="iBlockedThem"
        :they-blocked-me="theyBlockedMe"
        :no-content-tip="props.noContentTip"
        :active-contact="activeContact"
        :reply-target="replyTarget"
        :currentColorPalette="currentColorPalette"
        :selected-images="selectedImages"
        :selected-videos="selectedVideos"
        :selected-files="selectedFilesForInput"
        :show-emoji-picker="showEmojiPicker"
        :is-send-button-disabled="isSendButtonDisabled"
        :new-message="newMessage"
        :last-image-send-time="lastImageSendTime"
        :last-video-send-time="lastVideoSendTime"
        :last-text-send-time="lastTextSendTime"
        :last-file-send-time="lastFileSendTime"
        :messages-container-ref="messagesContainerRef"
        :scroll-to-bottom="scrollToBottom"
        :get-options="getOptions"
        :contacts="props.contacts"
        :right-chat-area-ref="{ value: { scrollToBottom } }"
        @update:new-message="newMessage = $event"
        @send-message="sendMessageLocal"
        @toggle-emoji-picker="toggleEmojiPicker"
        @select-media="selectMedia"
        @select-file="handleFileSelectLocal"
        @remove-image="removeImageLocal"
        @remove-video="removeVideoLocal"
        @remove-file="removeFileLocal"
        @preview-temp-image="previewTempImage"
        @preview-temp-video="previewTempVideo"
        @preview-file="previewTempFile"
        @play-video-on-hover="playVideoOnHover"
        @pause-video-on-leave="pauseVideoOnLeave"
        @add-screenshot="handleAddScreenshot"
        @cancel-reply="replyTarget = null"
      />

      <!-- 添加好友模态框 -->
      <AddFriendModal
        :visible="showAddFriendModal"
        :user-id="addFriendUserId"
        @update:visible="showAddFriendModal = $event"
      />

      <!-- 举报模态框 -->
      <ReportModal
        v-if="showReportModal && reportContactData"
        :visible="showReportModal"
        :contact="reportContactData"
        @update:visible="showReportModal = $event"
      />

      <!-- 消息右键菜单
           统一 Teleport 到 body：菜单用视口坐标（event.clientX/clientY）定位，
           挂到 body 可彻底摆脱祖先的层叠上下文 / overflow 裁剪影响，
           与 SystemMessageCard、ContactDrawer 的菜单实现保持一致。 -->
      <Teleport to="body">
        <MessageContextMenu
          :visible="contextMenuVisible"
          :position="contextMenuPosition"
          :message="selectedMessage"
          :contacts="props.contacts"
          :active-contact-id="props.activeContactId"
          :current-user-id="Number(props.currentUserId)"
          @close="closeContextMenu"
          @delete="handleMessageDelete"
          @recall="handleMessageRecall"
          @copy="handleMessageCopy"
          @reply="handleMessageReply"
          @forward="handleMessageForward"
          @multiSelect="handleMultiSelectMessage"
        />
      </Teleport>

      <!-- 转发选择器 -->
      <ForwardMessageModal
        :visible="showForwardModal"
        :messages="forwardTargetMessages"
        :contacts="props.contacts"
        :active-contact-id="props.activeContactId"
        :loading="forwarding"
        @update:visible="showForwardModal = $event"
        @confirm="handleForwardConfirm"
      />

      <!-- 文件预览组件 -->
      <ChatFilePreview
        :visible="showFilePreview"
        :file-info="previewFileInfo"
        @update:visible="showFilePreview = $event"
        @download="handleDownloadFile"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { getErrorMessage } from "../untils/errorMessage";
import {
  ref,
  reactive,
  computed,
  nextTick,
  watch,
  onMounted,
  onUnmounted,
  type Ref,
  type ComponentPublicInstance,
} from "vue";
import { useRouter } from "vue-router";
import { message, Modal } from "ant-design-vue";
import {
  LoadingOutlined,
  CloseOutlined,
  MinusOutlined,
  PlusOutlined,
  ReloadOutlined,
  SmileOutlined,
  PictureOutlined,
  LockOutlined,
  HistoryOutlined,
  WarningFilled,
} from "@ant-design/icons-vue";
import { useUserStore } from "../stores/user";
import { useCallStore } from "../stores/call";
import { useSiderColor } from "../stores/siderColor";
import GroupRiskModal from "./GroupRiskModal.vue";

import {
  handleTopToggle,
  handleMuteToggle,
  updateRemarkPlaceholder,
  handleRemarkFocus,
  handleRemarkInput,
  handleRemarkBlur,
  handleRemarkKeyUp,
  saveGroupRule,
  handleMoreActionCommand,
} from "../untils/chatAreaManager";

import {
  handleSendMessage,
  getChatHistory,
  handleUpdateGroupRule,
  handleEditRemark,
  handleSearchChatHistory,
  globalOriginalOrderManager, // 导入全局管理器
  updateContactLastMessage, // 导入更新联系人最后消息的函数
  formatMessageContent, // 生成统一的联系人列表摘要文案（含撤回文案）
} from "../untils/contactManager";

// 群详情：统一入口，带去重缓存，避免与列表刷新重复请求同一个群
import { fetchGroupDetail } from "../untils/messageManager";
import {
  type ChatMessage,
  type Contact,
  type UserInfo,
  type ColorPalette,
  type SelectedImage,
  type SelectedVideo,
} from "../types/chatTypes";
import { useShouldShowTimeStamp, useFormatMessageTime } from "../untils/rightchat";
import {
  selectImage as selectImageUtil,
  handleImageSelect,
  removeImage,
  previewImage,
  closeImagePreview,
  generateimageId,
} from "../untils/imageHandler";
import {
  selectVideo,
  handleVideoSelect,
  removeVideo,
  generateVideoId,
} from "../untils/videoHandler";
import { selectFile, handleFileSelect, removeFile, generateFileId } from "../untils/fileHandler";
import type { SelectedFile } from "../types/untilsTypes";
import { sendMessages } from "../untils/sendMessages";
import request from "../untils/request";
// 导入新组件
import MessageContextMenu from "./MessageContextMenu.vue";
import ChatFilePreview from "./ChatFilePreview.vue";
import ForwardMessageModal from "./ForwardMessageModal.vue";
import { forwardMessagesToTargets } from "../untils/forwardMessage";

// 导入MessageDisplay和MessageInputArea组件用于类型引用
import MessageDisplay from "./MessageDisplay.vue";
import MessageInputArea from "./MessageInputArea.vue";

// 定义 MessageInputArea 组件暴露的类型接口
interface MessageInputAreaInstance {
  messageTextareaRef: HTMLElement | null;
  handleInsertEmoji: (emoji: string) => void;
}

// 定义与 MessageInputArea 组件一致的 SelectedFileItem 类型（字段可选）
interface SelectedFileItem {
  id: string;
  file: File;
  name?: string;
  size?: number;
  type?: string;
  uploadProgress?: number;
  isUploading?: boolean;
  tempFilename?: string;
  previewUrl?: string; // 🔥 添加previewUrl,与图片/视频保持一致
}

// 获取用户状态、主题色状态实例和路由实例
const userStore = useUserStore();
const siderColorStore = useSiderColor();
const router = useRouter();

// Props定义 - 组件接收的外部属性
interface Props {
  contacts: Contact[]; // 联系人列表
  activeContactId: string | number; // 当前选中的联系人ID
  noContentTip?: string; // 无消息时的提示文本
  currentUserId?: string; // 当前登录用户ID
  readonly?: boolean; // 是否只读
  chatLoading?: boolean; // 会话消息是否正在加载（用于展示骨架屏）
}

const props = withDefaults(defineProps<Props>(), {
  noContentTip: "爱发消息的人 运气不会差...",
  currentUserId: "",
  chatLoading: false,
});

// 组件事件定义
const emit = defineEmits<{
  (e: "sendMessage", contactId: string | number, message: string, type?: string): void;
  (e: "editRemark", contactId: string | number, newRemark: string): void;
  (e: "clearChat", contactId: string | number): void;
  (e: "deleteFriend", contactId: string | number): void;
  (e: "deleteTemporaryContact", contactId: string | number): void;
  (e: "toggleTop", contactId: string | number, isTop: boolean): void;
  (e: "toggleMute", contactId: string | number, isMuted: boolean): void;
  (e: "quitGroup", groupId: string): void;
  (e: "dissolveGroup", groupId: string): void;
  (e: "updateGroupRule", groupId: string, rule: string): void;
  (e: "searchHistory", keyword: string, results: any[]): void;
  (e: "refreshContacts", forceRefresh?: boolean): void;
  (e: "send-message", payload: { userId: number; userInfo?: any }): void;
  (e: "contactSelect", contactId: string): void;
  (e: "startCall", contact: Contact, type: "audio" | "video"): void;
}>();

const messageDisplayRef = ref<ComponentPublicInstance | null>(null);
const messageInputAreaRef = ref<MessageInputAreaInstance | null>(null);
// 添加messagesContainerRef计算属性，从MessageDisplay组件中获取
const messagesContainerRef = computed(() => {
  return (messageDisplayRef.value as any)?.messagesContainerRef || null;
});
const showTimeTooltip = ref<number | null>(null);
// 抽屉显示控制
const showContactDrawer = ref(false); // 联系人详情抽屉显示状态
const newMessage = ref(""); // 新消息输入框内容
const messageTextareaRef = ref<HTMLElement | null>(null); // 消息输入框DOM引用
const isTop = ref(false); // 当前联系人是否置顶
const isMuted = ref(false); // 当前联系人是否静音
const showAllMembers = ref(false); // 是否显示群聊所有成员
const isMounted = ref(false); // 组件是否已挂载
const lastImageSelectionTime = ref<number | null>(null); // 上次选择图片的时间戳（频率限制）
const lastImageSendTime = ref<number | null>(null); // 上次发送图片的时间戳（频率限制）
const lastVideoSelectionTime = ref<number | null>(null); // 上次选择视频的时间戳（频率限制）
const lastVideoSendTime = ref<number | null>(null); // 上次发送视频的时间戳（频率限制）
const lastTextSendTime = ref<number | null>(null); // 上次发送文本的时间戳（频率限制）

// 文件相关
const fileInputRef = ref<HTMLInputElement | null>(null); // 文件选择输入框DOM引用
const selectedFiles = ref<SelectedFile[]>([]); // 选中待发送的文件列表
const lastFileSelectionTime = ref<number | null>(null); // 上次选择文件的时间戳（频率限制）
const lastFileSendTime = ref<number | null>(null); // 上次发送文件的时间戳（频率限制）
const lastRemoveFileTime = ref<number | null>(null); // 上次删除文件的时间戳（频率限制）
const historyScrollPosition = ref(0); // 加载历史消息前的滚动位置

// 🔥 使用计算属性返回ref对象，确保类型正确
const lastImageSendTimeRef = computed(() => lastImageSendTime);
const lastVideoSendTimeRef = computed(() => lastVideoSendTime);
const lastTextSendTimeRef = computed(() => lastTextSendTime);
const lastFileSendTimeRef = computed(() => lastFileSendTime);

// 搜索相关
const showSearchPanel = ref(false); // 聊天记录搜索面板显示状态
const searchKeyword = ref(""); // 搜索关键词
const searchResults = ref<ChatMessage[]>([]); // 搜索结果列表
const isSearching = ref(false); // 是否正在执行搜索
const hasSearched = ref(false); // 是否已经执行过搜索
const currentSearchPage = ref(1); // 搜索结果当前页码
const pageSize = 10; // 搜索结果每页条数
const searchInputRef = ref<HTMLInputElement | null>(null); // 搜索输入框DOM引用
const highlightedMessageId = ref<string | number | null>(null); // 需要高亮的消息ID

// 群公告相关
const isEditingRule = ref(false); // 是否正在编辑群公告
const tempGroupRule = ref(""); // 群公告编辑临时值
const defaultGroupRule = ref(``); // 群公告默认值

// 备注编辑相关
const tempRemark = ref(""); // 备注编辑临时值
const remarkEditableRef = ref<HTMLElement | null>(null); // 备注编辑框DOM引用

// 表情包选择器相关
const showEmojiPicker = ref(false); // 表情包选择器显示状态

// 图片相关
const imageInputRef = ref<HTMLInputElement | null>(null); // 图片选择输入框DOM引用
const selectedImages = ref<SelectedImage[]>([]); // 选中待发送的图片列表

// 视频相关
const videoInputRef = ref<HTMLInputElement | null>(null); // 视频选择输入框DOM引用
const selectedVideos = ref<SelectedVideo[]>([]); // 选中待发送的视频列表

// 图片预览相关
const showImagePreview = ref(false); // 图片预览弹窗显示状态
const previewImageUrl = ref(""); // 当前预览的图片URL
const previewImages = ref<string[]>([]); // 预览的图片列表
const currentPreviewIndex = ref(0); // 当前预览图片的索引
const showTempImagePreview = ref(false); // 临时图片预览显示状态
const currentTempPreviewIndex = ref(0); // 当前临时预览图片的索引

// 🔥 "正在输入"状态相关
const isTyping = ref(false); // 对方是否正在输入
let typingTimer: ReturnType<typeof setTimeout> | null = null; // 防抖定时器

// 🔥 群机器人「正在思考」状态（后端 bot_thinking_status 事件驱动）
const botThinking = ref(false);
let botThinkingTimer: ReturnType<typeof setTimeout> | null = null;

const resetBotThinking = () => {
  if (botThinkingTimer) {
    clearTimeout(botThinkingTimer);
    botThinkingTimer = null;
  }
  botThinking.value = false;
};

/**
 * 群机器人正在思考：只处理当前会话所在的群。
 * 兜底 60 秒自动收起，避免后端异常时提示一直挂着。
 */
const handleBotThinkingStatus = (data: any) => {
  const contact = activeContact.value;
  if (!contact?.isGroup) return;
  const targetGroupId = `group_${String(data?.groupId ?? "")}`;
  if (String(contact.id) !== targetGroupId) return;

  if (botThinkingTimer) {
    clearTimeout(botThinkingTimer);
    botThinkingTimer = null;
  }

  if (data?.active) {
    botThinking.value = true;
    botThinkingTimer = setTimeout(() => {
      botThinking.value = false;
      botThinkingTimer = null;
    }, 60000);
  } else {
    botThinking.value = false;
  }
};

// 视频预览相关
const showVideoPreview = ref(false); // 视频预览弹窗显示状态
const previewVideoUrl = ref(""); // 当前预览的视频 URL
const previewVideos = ref<string[]>([]); // 预览的视频列表
const currentVideoPreviewIndex = ref(0); // 当前预览视频的索引
const currentTempVideoPreviewIndex = ref(0); // 当前临时预览视频的索引
const showTempVideoPreview = ref(false); // 临时视频预览显示状态

// 文件预览相关
const showTempFilePreview = ref(false); // 临时文件预览显示状态
const currentTempFilePreviewIndex = ref(0); // 当前临时预览文件的索引

// 🔥 聊天文件预览相关（用于查看已发送的文件消息）
const showFilePreview = ref(false); // 文件预览弹窗显示状态
const previewFileInfo = ref<{
  url: string;
  filename: string;
  size: number;
  type: string;
} | null>(null); // 预览的文件信息

// 右键菜单相关
const contextMenuVisible = ref(false); // 右键菜单显示状态
const contextMenuPosition = ref({ x: 0, y: 0 }); // 右键菜单位置
const selectedMessage = ref<ChatMessage | null>(null); // 选中的消息
const selectedBubbleElement = ref<HTMLElement | null>(null); // 选中的消息气泡DOM元素
const replyTarget = ref<ChatMessage | null>(null); // 引用回复的目标消息

// 用户信息模态框相关
const showAddFriendModal = ref(false); // 添加好友模态框显示状态
const addFriendUserId = ref<number | null>(null); // 待添加的好友用户 ID
const showReportModal = ref(false); // 举报模态框显示状态
const reportContactData = ref<Contact | null>(null); // 待举报的联系人数据

// 多选模式相关状态
const isMultiSelectMode = ref(false); // 是否处于多选模式

// 🔥 拉黑状态（区分双向）
const iBlockedThem = ref(false); // 我是否拉黑了对方
const theyBlockedMe = ref(false); // 对方是否拉黑了我
const isBlocked = computed(() => iBlockedThem.value || theyBlockedMe.value); // 是否存在任意方向的拉黑

// 切换多选模式
const handleToggleMultiSelectMode = () => {
  isMultiSelectMode.value = !isMultiSelectMode.value;
};

// 处理重拨通话（从通话消息气泡点击）
const handleRedialCall = (payload: { callType: string; contactId?: string | number }) => {
  const callStore = useCallStore();
  const userStore = useUserStore();
  const contact = activeContact.value;
  if (!contact || !userStore.user?.id) return;

  callStore.startCall(
    payload.callType as "video" | "audio",
    String(userStore.user.id),
    String(contact.id),
    userStore.user.avatar || "",
    contact.avatar || "",
    contact.name,
  );
};

// 处理多选消息 - 从右键菜单触发
const handleMultiSelectMessage = (message: ChatMessage) => {
  // 进入多选模式
  isMultiSelectMode.value = true;

  // 选中当前消息（通过 MessageDisplay 暴露的 selectMessage 方法）
  if (message.id) {
    (messageDisplayRef.value as any)?.selectMessage?.(message.id);
  }

  // 关闭右键菜单
  closeContextMenu();
};

// 重试发送失败的消息：复用 clientMessageId，后端幂等去重，不重复入库
const handleRetrySendMessage = async (msg: ChatMessage) => {
  if (!activeContact.value) return;
  const type = msg.messageType || "text";

  // 媒体消息重试需重新上传文件，暂不支持，提示手动重发
  if (["image", "video", "file"].includes(type)) {
    message.info("媒体消息请重新选择后发送");
    return;
  }

  const clientMessageId = String(msg.id || "");

  // 先移除旧的失败消息，避免重试成功后出现两条
  const list = activeContact.value.messages;
  const idx = list.findIndex((m) => String(m.id) === clientMessageId);
  if (idx !== -1) list.splice(idx, 1);

  await handleSendMessage(
    props.activeContactId,
    msg.content || "",
    getOptions.value as any,
    userStore,
    type,
    undefined,
    undefined,
    undefined,
    undefined,
    (msg as any).replyTo,
    clientMessageId,
  );
};

// 切换表情包选择器显示状态
const toggleEmojiPicker = (e?: Event) => {
  if (e) {
    e.stopPropagation();
  }
  showEmojiPicker.value = !showEmojiPicker.value;
  nextTick(() => {
    if (messageInputAreaRef.value?.messageTextareaRef) {
      messageInputAreaRef.value.messageTextareaRef.focus();
    }
  });
};

// 关闭联系人抽屉
const closeContactDrawer = () => {
  showContactDrawer.value = false;
};

// 发送消息 - 支持文本、图片和视频消息
const sendMessageLocal = async () => {
  if (!activeContact.value) return;

  // 🔥 检查拉黑状态（区分双向）
  if (theyBlockedMe.value) {
    message.warning("对方已将你拉黑，无法发送消息");
    return;
  }
  if (iBlockedThem.value) {
    message.warning("你已拉黑对方，无法发送消息，请先取消拉黑");
    return;
  }

  // 🔥 修复：直接从输入框获取实际文本内容，而不是依赖可能过时的 newMessage ref
  const actualText = messageInputAreaRef.value?.messageTextareaRef?.innerText?.trim() || "";

  await sendMessages({
    messageTextareaRef: messageInputAreaRef.value?.messageTextareaRef || null,
    selectedImages,
    selectedVideos,
    selectedFiles, // 🔥 关键修复：传递 selectedFiles 参数
    lastImageSendTime,
    lastVideoSendTime,
    lastTextSendTime,
    lastFileSendTime, // 🔥 关键修复：传递 lastFileSendTime 参数
    newMessage: ref(actualText), // 🔥 修复：使用实际文本内容
    messagesContainerRef: messagesContainerRef.value,
    scrollToBottom,
    userStore,
    activeContactId: props.activeContactId,
    getOptions: getOptions.value,
    // 🔥 传递 activeContact 和 contacts,用于发送后清除 recalledContent
    activeContact: activeContact.value,
    contacts: props.contacts,
    // 🔥 关键修复：传递rightChatAreaRef以触发消息区域刷新和滚动
    rightChatAreaRef: { value: { scrollToBottom } },
    // 引用回复：把被引用的消息信息随发送一起带出
    replyTo: replyTarget.value
      ? {
          messageId: replyTarget.value.id,
          senderName:
            replyTarget.value.sender?.nickname ||
            replyTarget.value.sender?.username ||
            replyTarget.value.senderName ||
            "",
          content: replyTarget.value.content || "",
          messageType: replyTarget.value.messageType || "text",
        }
      : undefined,
  });

  // 🔥 修复：发送后同步清空 newMessage
  newMessage.value = "";
  replyTarget.value = null;
};

// 处理回车发送消息 - 非shift+回车时发送
const handleEnterKeyLocal = (event: KeyboardEvent) => {
  if (!event.shiftKey) {
    event.preventDefault(); // 阻止默认换行行为
    sendMessageLocal();
  }
};

// 插入表情到输入框
const insertEmoji = (emoji: string) => {
  // 通过子组件的 ref 访问子组件的 messageTextareaRef
  const textareaEl = messageInputAreaRef.value?.messageTextareaRef;
  if (!textareaEl) return;

  textareaEl.focus();

  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);

    if (range.toString()) {
      range.deleteContents();
    }

    const emojiNode = document.createTextNode(emoji);
    range.insertNode(emojiNode);

    // 将光标移到表情后面
    range.setStartAfter(emojiNode);
    range.setEndAfter(emojiNode);
    selection.removeAllRanges();
    selection.addRange(range);

    // 更新输入框内容（触发 input 事件）
    const inputEvent = new InputEvent("input", {
      bubbles: true,
      cancelable: true,
    });
    textareaEl.dispatchEvent(inputEvent);
  } else {
    // Fallback: 直接添加到末尾并触发 input 事件
    textareaEl.innerText += emoji;
    const inputEvent = new InputEvent("input", {
      bubbles: true,
      cancelable: true,
    });
    textareaEl.dispatchEvent(inputEvent);
  }

  // 立即关闭表情选择器
  showEmojiPicker.value = false;
};

// 点击页面其他区域关闭表情包选择器
// 注：右键菜单的关闭统一由 MessageContextMenu 内部的 document 监听负责，
// 这里不再重复处理（原先仅判断 .message-bubble，卡片类消息不在该选择器内，判断过窄）。
const handleClickOutside = (e: Event) => {
  const target = e.target as Element;

  // 判断点击目标是否在表情包选择器/工具栏/输入框外
  if (
    !target.closest(".emoji-picker") &&
    !target.closest(".input-tool-btn") &&
    !target.closest(".message-textarea-div")
  ) {
    showEmojiPicker.value = false;
  }
};

// 选择媒体文件（图片或视频）- 统一处理图片和视频选择
const selectMedia = () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*,video/*"; // 支持图片和视频格式
  input.multiple = true;
  input.style.display = "none";

  input.onchange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const files = target.files;

    if (!files || files.length === 0) {
      // 确保元素存在再移除
      if (input.parentNode) {
        input.remove();
      }
      return;
    }

    // 分别处理图片和视频文件
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith("image/"));
    const videoFiles = Array.from(files).filter((file) => file.type.startsWith("video/"));

    // 如果有图片文件，处理图片
    if (imageFiles.length > 0) {
      // 创建临时input用于处理图片文件
      const imageInput = document.createElement("input");
      imageInput.type = "file";
      imageInput.accept = "image/*";
      imageInput.multiple = true;
      imageInput.style.display = "none";

      // 使用DataTransfer API来设置文件
      const imageDt = new DataTransfer();
      imageFiles.forEach((file) => imageDt.items.add(file));
      imageInput.files = imageDt.files;

      // 手动触发图片处理逻辑
      handleImageSelect({ target: imageInput } as unknown as Event, {
        selectedMedias: selectedImages,
        lastMediaSelectionTime: lastImageSelectionTime,
        lastMediaSendTime: lastImageSendTime,
        activeContact: activeContact,
        showMediaPreview: showImagePreview,
        previewMedias: previewImages,
        currentPreviewIndex: currentPreviewIndex,
      });

      // 清理临时元素
      if (imageInput.parentNode) {
        imageInput.remove();
      }
    }

    // 如果有视频文件，处理视频
    if (videoFiles.length > 0) {
      // 创建临时input用于处理视频文件
      const videoInput = document.createElement("input");
      videoInput.type = "file";
      videoInput.accept = "video/*";
      videoInput.multiple = true;
      videoInput.style.display = "none";

      // 使用DataTransfer API来设置文件
      const videoDt = new DataTransfer();
      videoFiles.forEach((file) => videoDt.items.add(file));
      videoInput.files = videoDt.files;

      // 手动触发视频处理逻辑
      handleVideoSelect({ target: videoInput } as unknown as Event, {
        selectedMedias: selectedVideos,
        lastMediaSelectionTime: lastVideoSelectionTime,
        activeContact: activeContact,
        showMediaPreview: showVideoPreview,
        previewMedias: previewVideos,
        currentPreviewIndex: currentVideoPreviewIndex,
        lastMediaSendTime: lastVideoSendTime,
      });

      // 清理临时元素
      if (videoInput.parentNode) {
        videoInput.remove();
      }
    }

    // 确保元素存在再移除
    if (input.parentNode) {
      input.remove();
    }
  };

  document.body.appendChild(input);
  input.click();
};

// 删除选中的图片 - 同时删除临时文件
const removeImageLocal = async (id: string) => {
  await removeImage(id, selectedImages);
};

// 删除选中的视频 - 同时删除临时文件
const removeVideoLocal = async (id: string) => {
  await removeVideo(id, {
    selectedMedias: selectedVideos,
    lastMediaSelectionTime: lastVideoSelectionTime,
    lastMediaSendTime: lastVideoSendTime,
    activeContact: activeContact,
    showMediaPreview: showVideoPreview,
    previewMedias: previewVideos,
    currentPreviewIndex: currentVideoPreviewIndex,
  });
};

// 处理文件选择
const handleFileSelectLocal = async (files: File[]) => {
  if (!activeContact.value) {
    message.warning("请先选择一个联系人");
    return;
  }

  // 创建临时的input元素来触发文件选择
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.style.display = "none";

  // 使用DataTransfer API来设置文件
  const dt = new DataTransfer();
  files.forEach((file) => dt.items.add(file));
  input.files = dt.files;

  // 调用fileHandler处理文件
  await handleFileSelect({ target: input } as unknown as Event, {
    selectedFiles,
    lastFileSelectionTime: lastFileSelectionTime,
    lastFileSendTime: lastFileSendTime,
    activeContact: activeContact,
  });

  // 清理临时元素
  if (input.parentNode) {
    input.remove();
  }
};

// 删除选中的文件 - 同时删除临时文件
const removeFileLocal = async (id: string) => {
  await removeFile(id, selectedFiles, lastRemoveFileTime);
};

// 处理截图添加 - 将截图添加到图片列表
const handleAddScreenshot = (screenshot: SelectedImage) => {
  // 检查是否已达到最大图片数量限制（5个）
  if (selectedImages.value.length >= 5) {
    message.warning("最多只能选择5个图片或视频");
    return;
  }

  // 将截图添加到图片列表
  selectedImages.value.push(screenshot);
  message.success("截图已添加，可直接发送");
};

// 预览临时图片 - 显示用户选择的图片预览
const previewTempImage = (image: SelectedImage, index: number) => {
  currentTempPreviewIndex.value = index;
  showTempImagePreview.value = true;
};

// 预览临时视频 - 显示用户选择的视频预览
const previewTempVideo = (video: SelectedVideo, index: number) => {
  currentTempVideoPreviewIndex.value = index;
  showTempVideoPreview.value = true;
};

// 预览图片 - 从聊天记录中提取所有图片并定位当前图片
const previewImageLocal = (imageUrl: any) => {
  previewImage(imageUrl, activeContact, previewImages, currentPreviewIndex, showImagePreview);
};

// 关闭图片预览弹窗
const closeImagePreviewLocal = () => {
  closeImagePreview(showImagePreview, previewImageUrl);
};

// 关闭临时图片预览
const closeTempImagePreview = () => {
  showTempImagePreview.value = false;
  currentTempPreviewIndex.value = 0;
};

// 处理临时图片删除
const handleDeleteTempImage = async (imageId: string) => {
  try {
    await removeImageLocal(imageId);
  } catch (error) {
    console.error("删除临时图片失败:", error);
    message.error("删除图片失败");
  }
};

// 预览视频 - 从聊天记录中提取所有视频并定位当前视频
const previewVideoLocal = (videoUrl: any) => {
  previewVideos.value = [videoUrl]; // 只放当前点击的视频
  currentVideoPreviewIndex.value = 0;
  showVideoPreview.value = true;
};

// 关闭视频预览弹窗
const closeVideoPreviewLocal = () => {
  showVideoPreview.value = false;
  previewVideoUrl.value = "";
};

// 关闭临时视频预览
const closeTempVideoPreview = () => {
  showTempVideoPreview.value = false;
  currentTempVideoPreviewIndex.value = 0;
};

// 处理临时视频删除
const handleDeleteTempVideo = async (videoId: string) => {
  try {
    await removeVideoLocal(videoId);
  } catch (error) {
    console.error("删除临时视频失败:", error);
    message.error("删除视频失败");
  }
};

// 计算属性 - 当前预览的文件
const currentPreviewFile = computed(() => {
  if (selectedFiles.value.length === 0) return null;
  return selectedFiles.value[currentTempFilePreviewIndex.value] || null;
});

// 预览临时文件 - 显示用户选择的文件预览
const previewTempFile = (file: SelectedFileItem) => {
  // 找到对应的SelectedFile对象
  const targetFile = selectedFiles.value.find((f) => f.id === file.id);
  if (targetFile) {
    const actualIndex = selectedFiles.value.indexOf(targetFile);
    currentTempFilePreviewIndex.value = actualIndex;
    showTempFilePreview.value = true;
  }
};

// 关闭临时文件预览
const closeTempFilePreview = () => {
  showTempFilePreview.value = false;
};

currentTempFilePreviewIndex.value = 0;

// 处理临时文件删除
const handleDeleteTempFile = async (fileId: string) => {
  try {
    await removeFileLocal(fileId);
  } catch (error) {
    console.error("删除临时文件失败:", error);
    message.error("删除文件失败");
  }
};

// 计算属性 - 当前主题色配置
const currentColorPalette = computed<ColorPalette>(() => {
  return siderColorStore.currentColorPalette;
});

// 计算属性 - 聊天区域样式（背景和主题色变量）
const chatAreaStyle = computed(() => ({
  // 个性装扮（动态背景）时全透明，透出底层视频/图片
  background: hasDynamicBackground.value ? "transparent" : siderColorStore.chatBgGradient,
  "--primary-color": currentColorPalette.value.color,
  "--primary-hover": currentColorPalette.value.hover,
  "--primary-light": currentColorPalette.value.light,
}));

// 个性装扮：动态背景（视频/图片）——背景层在页面外层，这里仅需透明
const hasDynamicBackground = computed(() => siderColorStore.hasDynamicBackground);

// 计算属性 - 聊天头部样式（渐变背景和边框）
const chatHeaderStyle = computed(() => {
  // 个性装扮（动态背景）时头部透明，透出底层视频/图片
  if (hasDynamicBackground.value) {
    return {
      background: "transparent",
      borderBottom: `1px solid ${siderColorStore.panelDividerColor}`,
    };
  }
  return {
    background: `linear-gradient(135deg, ${siderColorStore.currentColorPalette?.chatBgStart || "#f5f7fa"} 0%, ${siderColorStore.currentColorPalette?.chatBgMiddle || "#e5e9f2"} 50%, ${siderColorStore.currentColorPalette?.chatBgEnd || "#d0d8e8"} 100%)`,
    // 头部底部分割线：统一用 panelDividerColor，与右侧 border-right、联系人列表/输入框分割线保持一致。
    // 原 `${light}80` 中 light 是 rgba 字符串，拼接后为无效颜色，导致分割线不可见。
    borderBottom: `1px solid ${siderColorStore.panelDividerColor}`,
  };
});

// 计算属性 - 输入区域样式
const inputAreaStyle = computed(() => ({
  background: siderColorStore.chatBgGradient,
  borderTop: `1px solid ${currentColorPalette.value.active}20`,
}));

// 添加计算属性来获取当前活动联系人
const activeContact = computed(() => {
  return props.contacts.find((contact) => contact.id === props.activeContactId);
});

// ==================== 群聊风险提示（QQ 式安全提醒） ====================
const showRiskDetail = ref(false); // 风险详情弹窗
/** 已关闭横幅的群 id 集合（按「群 id + 风险等级」记忆，等级变化时重新提示） */
const dismissedRiskKeys = ref<Set<string>>(new Set());

/** 当前群的风险等级 */
const currentRiskLevel = computed(() => {
  const c = activeContact.value;
  if (!c || !c.isGroup) return "normal";
  return c.riskLevel || "normal";
});

/** 是否展示风险横幅：群聊 + 有风险 + 未被用户关闭 */
const showRiskBanner = computed(() => {
  if (currentRiskLevel.value === "normal") return false;
  const c = activeContact.value;
  if (!c) return false;
  const key = `${c.id}_${currentRiskLevel.value}`;
  return !dismissedRiskKeys.value.has(key);
});

/** 横幅颜色分级 */
const riskBannerLevel = computed(() => currentRiskLevel.value);

/** 横幅文案 */
const riskBannerText = computed(() => {
  switch (currentRiskLevel.value) {
    case "severe":
      return "该群聊存在严重安全风险，请谨慎甄别信息";
    case "high":
      return "该群聊存在较高安全风险，请注意防范";
    case "warning":
      return "该群聊近期被多次举报，请注意防范风险";
    case "watch":
      return "该群聊近期收到举报，请谨慎甄别信息";
    default:
      return "";
  }
});

/** 关闭横幅（按群 + 等级记忆，等级升高会重新提示） */
const dismissRiskBanner = () => {
  const c = activeContact.value;
  if (!c) return;
  dismissedRiskKeys.value.add(`${c.id}_${currentRiskLevel.value}`);
  // 触发响应式更新（Set 的原地修改不会被 Vue 侦测）
  dismissedRiskKeys.value = new Set(dismissedRiskKeys.value);
};

// 🔥 监听活动联系人变化，检查双向拉黑状态
watch(
  () => props.activeContactId,
  async (newId) => {
    if (!newId) {
      iBlockedThem.value = false;
      theyBlockedMe.value = false;
      return;
    }
    const contact = props.contacts.find((c) => c.id === newId);
    if (!contact || contact.isGroup) {
      iBlockedThem.value = false;
      theyBlockedMe.value = false;
      return;
    }
    try {
      const response = await request.get(`/blocked-users/${newId}/is-blocked`);
      const data = response.data;
      // 兼容新旧API返回格式
      if (data.hasOwnProperty("iBlockedThem")) {
        iBlockedThem.value = data.iBlockedThem || false;
        theyBlockedMe.value = data.theyBlockedMe || false;
      } else {
        // 旧版API兼容：isBlocked 仅表示"我拉黑了对方"
        iBlockedThem.value = data.isBlocked || false;
        theyBlockedMe.value = false;
      }
    } catch (error) {
      console.error("检查拉黑状态失败:", error);
      iBlockedThem.value = false;
      theyBlockedMe.value = false;
    }
  },
  { immediate: true },
);

// 🔥 计算属性 - 将 SelectedFile 转换为 SelectedFileItem 格式（用于 MessageInputArea 组件）
const selectedFilesForInput = computed(() => {
  return selectedFiles.value.map((file) => ({
    id: file.id,
    file: file.file,
    name: file.file.name,
    size: file.file.size,
    type: file.file.type,
    previewUrl: file.previewUrl, // 🔥 添加previewUrl,与图片/视频保持一致
    tempFilename: file.tempFilename, // 🔥 添加tempFilename
  }));
});

// 处理发起通话事件 - 包装函数以提供类型安全
const handleStartCall = (contact: Contact, type: "audio" | "video") => {
  emit("startCall", contact, type);
};

//  统一处理不同事件的参数格式
const compatibleEmit = (event: string, ...args: any[]) => {
  const emitMap: Record<string, Function> = {
    sendMessage: (id: string | number, msg: string, type?: string) =>
      emit("sendMessage", id, msg, type),
    editRemark: (id: string | number, remark: string) => emit("editRemark", id, remark),
    clearChat: (id: string | number) => emit("clearChat", id),
    deleteFriend: (id: string | number) => emit("deleteFriend", id),
    toggleTop: (id: string | number, isTop: boolean) => emit("toggleTop", id, isTop),
    toggleMute: (id: string | number, isMuted: boolean) => emit("toggleMute", id, isMuted),
    quitGroup: (groupId: string) => emit("quitGroup", groupId),
    dissolveGroup: (groupId: string) => emit("dissolveGroup", groupId),
    updateGroupRule: (groupId: string, rule: string) => emit("updateGroupRule", groupId, rule),
    searchHistory: (keyword: string, results: any[]) => handleSearchHistoryResult(keyword, results),
  };

  if (emitMap[event]) {
    emitMap[event](...args);
  }
};

//  获取传递给工具函数的配置项
const getOptions = computed(() => ({
  contacts: props.contacts,
  activeContactId: props.activeContactId,
  currentUserId: props.currentUserId || "",
  newMessage: { value: newMessage.value },
  isTop: { value: isTop.value },
  isMuted: { value: isMuted.value },
  showContactDrawer: { value: showContactDrawer.value },
  isEditingRule: { value: isEditingRule.value },
  tempGroupRule: { value: tempGroupRule.value },
  defaultGroupRule: { value: defaultGroupRule.value },
  showAllMembers: { value: showAllMembers.value },
  tempRemark: { value: tempRemark.value },
  remarkEditableRef: { value: remarkEditableRef.value },
  activeContact: { value: activeContact.value },
  emit: (event: string, ...args: any[]): void => {
    compatibleEmit(event, ...args);
  },
}));

// 处理编辑群信息 - 跳转到群编辑页面（仅群主可操作）
const handleEditGroupInfo = () => {
  if (!activeContact.value) {
    message.error("未选择群聊");
    return;
  }

  showContactDrawer.value = false;
  router.push(`/editgroup/${activeContact.value.id}`);
};

// 跳转到编辑页面 - 区分群聊和好友
const navigateToEdit = () => {
  if (!activeContact.value) {
    message.error("未选择联系人");
    return;
  }

  if (activeContact.value.isGroup) {
    // 群聊 - 仅群主可编辑
    if (isCurrentUserGroupOrAdmin.value) {
      router.push(`/editgroup/${activeContact.value.id}`);
    } else {
      message.warning("你没有权限访问群信息");
    }
  } else {
    // 好友 - 跳转到账号管理
    router.push(`/account`);
  }
};

// 跳转到群成员管理页面 - 仅群主和管理员可操作
const navigateToManageMembers = () => {
  if (!activeContact.value) {
    message.error("未选择群聊");
    return;
  }

  if (!isCurrentUserGroupOrAdmin.value) {
    message.warning("只有群主和管理员可以管理群成员");
    return;
  }

  showContactDrawer.value = false;
  router.push(`/profile/${props.currentUserId}?groupId=${activeContact.value.id}`);
};

// 点击头像跳转到用户信息页面 - 区分群聊和好友场景
const navigateToUserInfo = (userId: string | number) => {
  if (!userId) {
    message.error("用户ID不能为空");
    return;
  }

  if (activeContact.value?.isGroup) {
    router.push(`/self-profile/${userId}?groupId=${activeContact.value.id}`);
  } else {
    router.push(`/self-profile/${userId}`);
  }
};

// 点击主区域关闭联系人抽屉
const handleMainAreaClick = () => {
  showContactDrawer.value = false;
};

// 阻止抽屉内部点击事件冒泡到主区域
const handleDrawerClick = () => {};

// 切换搜索面板显示状态 - 打开时自动聚焦搜索框
const toggleSearchPanel = () => {
  showSearchPanel.value = !showSearchPanel.value;
  if (showSearchPanel.value) {
    nextTick(() => {
      if (searchInputRef.value) {
        searchInputRef.value.focus();
      }
    });
  }
  showContactDrawer.value = false; // 关闭联系人抽屉
};

// 关闭搜索面板并清空搜索状态
const closeSearchPanel = () => {
  showSearchPanel.value = false;
  clearSearch();
};

// 清空搜索相关状态
const clearSearch = () => {
  searchKeyword.value = "";
  hasSearched.value = false;
  searchResults.value = [];
  highlightedMessageId.value = null;
  currentSearchPage.value = 1;
};

// 清空搜索结果（保留关键词）
const clearSearchResults = () => {
  searchResults.value = [];
  hasSearched.value = false;
  highlightedMessageId.value = null;
  currentSearchPage.value = 1;
};

// 执行聊天记录搜索
const performSearch = async (filters?: {
  messageType?: string;
  startDate?: string;
  endDate?: string;
  memberId?: string;
}) => {
  // 验证搜索条件
  if (!searchKeyword.value.trim()) {
    message.warning("请输入搜索关键词");
    return;
  }

  if (!activeContact.value) {
    message.error("未选择联系人");
    return;
  }

  isSearching.value = true;

  try {
    // 调用搜索工具函数，传递筛选参数
    const results = await handleSearchChatHistory(props.activeContactId, searchKeyword.value, {
      messageType: filters?.messageType || "",
      startDate: filters?.startDate || "",
      endDate: filters?.endDate || "",
      memberId: filters?.memberId || "",
    });

    // 更新搜索结果 - handleSearchChatHistory 已返回消息数组
    searchResults.value = (results as ChatMessage[]) || [];
    hasSearched.value = true;
    currentSearchPage.value = 1;
  } catch (error) {
    console.error("搜索失败:", error);
    message.error("搜索失败，请稍后重试");
  } finally {
    isSearching.value = false;
  }
};

// 处理搜索结果分页切换
const handlePageChange = (page: number) => {
  currentSearchPage.value = page;
};

// 计算属性 - 分页后的搜索结果
const paginatedResults = computed(() => {
  const start = (currentSearchPage.value - 1) * pageSize;
  const end = start + pageSize;
  return searchResults.value.slice(start, end);
});

// 计算属性 - 搜索结果总页数
const totalPages = computed(() => {
  return Math.ceil(searchResults.value.length / pageSize);
});

// 滚动到指定消息位置并高亮显示
const scrollToMessage = (payload: {
  id: string | number;
  messageType: string;
  content: string;
}) => {
  const messageId = typeof payload === "object" ? payload.id : payload;
  highlightedMessageId.value = messageId;
  const messageElement = document.getElementById(`message-${messageId}`);
  if (messageElement) {
    // 平滑滚动到消息位置
    messageElement.scrollIntoView({ behavior: "smooth", block: "center" });
    // 添加高亮动画
    messageElement.classList.add("highlight-animation");
    // 2秒后移除动画
    setTimeout(() => {
      messageElement.classList.remove("highlight-animation");
    }, 2000);
  }
};

/**
 * 入群通知数据源。
 *
 * 优先用后端群详情接口返回的 `joinNotices` 数组（权威数据源，含该群全部历史入群记录）；
 * 老数据 / 接口未升级时回退到前端从聊天消息反解出的 `joinMessages`。
 */
const joinNoticeSource = computed<any[]>(() => {
  const contact = activeContact.value as any;
  if (!contact?.isGroup) return [];
  if (Array.isArray(contact.joinNotices) && contact.joinNotices.length > 0) {
    return contact.joinNotices;
  }
  return Array.isArray(contact.joinMessages) ? contact.joinMessages : [];
});

// 是否具备 source 字段可用于区分「初始成员」与「新加入成员」
const hasJoinSource = computed(() =>
  joinNoticeSource.value.some((n: any) => n?.source !== undefined),
);

// 初始/默认成员（统一 tag）：后端群详情返回的历史成员，source 固定为 "join"；
// 无 source 信息时全部视为初始成员（旧数据兜底）。
const initialJoinNotices = computed<any[]>(() => {
  const list = joinNoticeSource.value;
  if (!list.length) return [];
  if (!hasJoinSource.value) return list;
  return list.filter((n: any) => n?.source === "join");
});

// 新加入成员（单独 tag）：实时 WS 推送的，source 为 invite / application / public / create 等非 "join"
const newJoinNotices = computed<any[]>(() => {
  const list = joinNoticeSource.value;
  if (!list.length || !hasJoinSource.value) return [];
  return list.filter((n: any) => n?.source !== undefined && n?.source !== "join");
});

// 计算属性 - 初始成员汇总提示文本（最多显示 6 个，超出显示数量）
const joinMessageDisplayText = computed(() => {
  const notices = initialJoinNotices.value;
  if (notices.length === 0) return "";

  const groupName = activeContact.value?.name || "";
  const totalCount = notices.length;
  const threshold = 6;

  const names = notices.map((m: any) => m.userName).filter(Boolean);

  if (names.length === 0) return "";

  if (totalCount <= threshold) {
    return `${names.join("、")} 加入了${groupName}`;
  }

  const showNames = names.slice(0, 6).join("、");
  return `${showNames} 等${totalCount}位成员加入了${groupName}`;
});

// 新加入成员列表（每条独立 tag，不合并进初始汇总）
const joinNewMembers = computed(() =>
  [...newJoinNotices.value]
    .sort((a: any, b: any) => {
      const ta = new Date(a?.time || a?.joinedAt || 0).getTime();
      const tb = new Date(b?.time || b?.joinedAt || 0).getTime();
      return (isNaN(ta) ? 0 : ta) - (isNaN(tb) ? 0 : tb);
    })
    .map((n: any) => ({
      userName: n.userName,
      time: n.time || n.joinedAt || "",
    })),
);

// 滚动到消息底部 - 确保最新消息可见
const scrollToBottom = () => {
  if (!messagesContainerRef.value) return;

  nextTick(() => {
    // 移除定时器，直接滚动到底部
    if (messagesContainerRef.value) {
      messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight;
    }
  });
};

// 组件挂载生命周期 - 初始化状态、滚动到底部、绑定事件
onMounted(async () => {
  isMounted.value = true;
  await userStore.initializeAuth(); // 初始化用户认证
  await siderColorStore.initTheme(); // 初始化主题
  scrollToBottom(); // 滚动到消息底部
  await nextTick();
  // 聚焦输入框
  if (messageTextareaRef.value) {
    messageTextareaRef.value.focus();
  }

  // 绑定点击外部关闭表情包选择器事件
  document.addEventListener("click", handleClickOutside);

  // 🔥 监听"正在输入"状态
  setupTypingStatusListener();
});

/**
 * 🔥 设置"正在输入"状态的WebSocket监听
 */
const setupTypingStatusListener = async () => {
  try {
    const { websocketService } = await import("../untils/websocket");

    // 监听对方正在输入的状态
    websocketService.on("typing_status", handleTypingStatusUpdate);
    // 监听群机器人「正在思考」状态
    websocketService.on("bot_thinking_status", handleBotThinkingStatus);
  } catch (error) {
    console.error("[RightChatArea] 设置正在输入监听失败:", error);
  }
};

/**
 * 🔥 处理"正在输入"状态更新
 */
const handleTypingStatusUpdate = (data: any) => {
  try {
    const { fromUserId, isTyping: typing } = data;
    const currentContactId = activeContact.value?.id;

    // 只处理当前聊天对象的输入状态
    if (!currentContactId || String(fromUserId) !== String(currentContactId)) {
      return;
    }

    // 清除之前的定时器
    if (typingTimer) {
      clearTimeout(typingTimer);
    }

    if (typing) {
      // 显示"正在输入"
      isTyping.value = true;

      // 3秒后自动隐藏(防止对方异常断开导致一直显示)
      typingTimer = setTimeout(() => {
        isTyping.value = false;
      }, 3000);
    } else {
      // 立即隐藏
      isTyping.value = false;
    }
  } catch (error) {
    console.error("[RightChatArea] 处理正在输入状态失败:", error);
  }
};

// 刷新聊天记录 - 用于群聊邀请操作后重新加载消息
const refreshChatHistory = async () => {
  if (!activeContact.value || !props.currentUserId) return;

  try {
    // 调用 getChatHistory 重新获取聊天记录
    await getChatHistory(activeContact.value.id, {
      contacts: props.contacts,
      activeContactId: ref(String(props.activeContactId)),
      currentUserId: String(props.currentUserId),
      forceFetch: true,
    });

    // 滚动到底部
    scrollToBottom();
  } catch (error) {
    console.error("刷新聊天记录失败:", error);
  }
};

//  清理事件监听和临时资源
onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
  closeImagePreviewLocal(); // 关闭图片预览
  closeVideoPreviewLocal(); // 关闭视频预览

  // 🔥 清理"正在输入"状态的WebSocket监听
  cleanupTypingStatusListener();

  // 🔥 清除群机器人「正在思考」状态
  resetBotThinking();

  // 🔥 清除防抖定时器
  if (typingTimer) {
    clearTimeout(typingTimer);
    typingTimer = null;
  }

  // 释放图片预览URL
  selectedImages.value.forEach((img: any) => {
    if (img.previewUrl) {
      URL.revokeObjectURL(img.previewUrl);
    }
  });

  // 释放视频预览URL
  selectedVideos.value.forEach((vid: any) => {
    if (vid.previewUrl) {
      URL.revokeObjectURL(vid.previewUrl);
    }
  });

  // 🔥 释放文件预览URL(与图片/视频保持一致)
  selectedFiles.value.forEach((file: any) => {
    if (file.previewUrl) {
      URL.revokeObjectURL(file.previewUrl);
    }
  });
});

/**
 * 🔥 清理"正在输入"状态的WebSocket监听
 */
const cleanupTypingStatusListener = async () => {
  try {
    const { websocketService } = await import("../untils/websocket");
    websocketService.off("typing_status", handleTypingStatusUpdate);
    websocketService.off("bot_thinking_status", handleBotThinkingStatus);
  } catch (error) {
    console.error("[RightChatArea] 清理正在输入监听失败:", error);
  }
};

// 计算属性 - 判断当前联系人是否是自己
const isCurrentUserContact = computed(() => {
  if (!activeContact.value || !props.currentUserId) return false;
  return String(activeContact.value.id).trim() === String(props.currentUserId).trim();
});

// 计算属性 - 获取群群主信息
const groupOwner = computed(() => {
  return activeContact.value?.owner;
});

// 计算属性 - 显示的群成员列表（最多显示5个）
const displayedMembersWithOwner = computed(() => {
  if (!activeContact.value?.groupMembers) return [];

  if (activeContact.value.groupMembers.length === 1) {
    return activeContact.value.groupMembers;
  }

  return activeContact.value.groupMembers.slice(0, 5);
});

// 计算属性 - 判断当前用户是否是群主
const isCurrentUserGroupOwner = computed(() => {
  if (!activeContact.value?.isGroup) return false;
  const currentUserId = String(props.currentUserId).trim();

  const groupOwnerId =
    activeContact.value.groupOwnerId ||
    (activeContact.value.owner && String(activeContact.value.owner.id));

  return currentUserId === String(groupOwnerId).trim();
});

// 计算属性 - 判断当前用户是否是群主或管理员
const isCurrentUserGroupOrAdmin = computed(() => {
  if (!activeContact.value?.isGroup) return false;
  const currentUserId = String(props.currentUserId).trim();

  const groupOwnerId =
    activeContact.value.groupOwnerId ||
    (activeContact.value.owner && String(activeContact.value.owner.id));

  if (currentUserId === String(groupOwnerId).trim()) {
    return true;
  }

  const explicitAdmins = Array.isArray(activeContact.value.admin) ? activeContact.value.admin : [];
  const derivedAdmins = Array.isArray(activeContact.value.groupMembers)
    ? activeContact.value.groupMembers.filter(
        (member: any) => String(member?.role || "").toLowerCase() === "admin",
      )
    : [];

  return [...explicitAdmins, ...derivedAdmins].some((admin: any) => {
    const adminId = String(admin?.id ?? admin?.userId ?? admin?.user?.id ?? "").trim();
    return adminId === currentUserId;
  });
});

// 计算属性 - 获取当前群公告内容
const groupRule = computed(() => {
  return activeContact.value?.groupRule;
});

// 计算属性 - 获取群管理员列表（排除群主）
const groupAdmins = computed(() => {
  if (!activeContact.value?.isGroup) {
    return [];
  }

  const explicitAdmins = Array.isArray(activeContact.value.admin) ? activeContact.value.admin : [];
  const derivedAdmins = Array.isArray(activeContact.value.groupMembers)
    ? activeContact.value.groupMembers
        .filter((member: any) => String(member?.role || "").toLowerCase() === "admin")
        .map((member: any) => ({
          ...member,
          id: member.id ?? member.userId ?? member.user?.id,
          name: member.name ?? member.nickname ?? member.username ?? "管理员",
          role: "admin",
        }))
    : [];

  const ownerId =
    activeContact.value.groupOwnerId ||
    (activeContact.value.owner && String(activeContact.value.owner.id));

  const mergedAdmins = [...explicitAdmins, ...derivedAdmins];
  return mergedAdmins.filter((admin: any) => {
    const adminId = String(admin?.id ?? admin?.userId ?? admin?.user?.id ?? "");
    return !ownerId || adminId !== String(ownerId);
  });
});

// 计算属性 - 过滤出普通群成员（排除群主和管理员）
const filteredNormalMembers = computed(() => {
  if (!activeContact.value?.groupMembers) return [];

  const ownerId =
    activeContact.value.groupOwnerId || (activeContact.value.owner && activeContact.value.owner.id);

  const adminIds =
    activeContact.value.admin && Array.isArray(activeContact.value.admin)
      ? activeContact.value.admin.map((admin: any) => admin.id)
      : [];

  const excludedIds = new Set([ownerId, ...adminIds].filter((id) => id).map((id) => String(id)));

  return activeContact.value.groupMembers.filter((member: any) => {
    return !excludedIds.has(String(member.id));
  });
});

// 响应式对象 - 当前用户信息
const userInfo: UserInfo = reactive({
  avatar: userStore.userAvatar,
  username: userStore.user?.username,
});

// 获取消息发送者的头像 - 区分群聊和好友场景
const getMessageAvatar = (message: ChatMessage) => {
  if (!activeContact.value) return userInfo.avatar;

  if (activeContact.value.isGroup) {
    // 群聊场景
    if (message.isMe) return userInfo.avatar; // 自己的消息
    if (message.senderId && activeContact.value.groupMembers) {
      // 群成员的消息
      const member = activeContact.value.groupMembers.find((m: any) => m.id === message.senderId);
      return member?.avatar || activeContact.value.avatar;
    }
    return activeContact.value.avatar;
  }

  // 好友场景
  return message.isMe ? userInfo.avatar : activeContact.value.avatar;
};

// 计算属性 - 判断是否是和自己聊天
const isSelfChat = computed(() => {
  if (!activeContact.value || !props.currentUserId) return false;
  if (activeContact.value.isGroup) return false;
  return String(activeContact.value.id).trim() === String(props.currentUserId).trim();
});

// 监听当前选中联系人变化 - 更新状态和 UI
watch(
  () => activeContact.value,
  async (newVal: any) => {
    if (!isMounted.value || !newVal) return;
    await nextTick();

    isTop.value = newVal.isTop || false;
    isMuted.value = newVal.isMuted || false;

    if (newVal.isGroup) {
      const groupId = String(newVal.id);
      try {
        // 统一走 fetchGroupDetail：与列表刷新共用去重缓存，避免同一个群详情连发两次
        const groupData = await fetchGroupDetail(groupId);
        if (groupData) {
          const contactInList = props.contacts.find((c) => String(c.id) === String(newVal.id));
          if (contactInList) {
            contactInList.muteAll = groupData.muteAll;
            contactInList.role = groupData.role;
            contactInList.groupRule = groupData.rule;
          }
        }
      } catch (error: any) {
        // 打印接口与响应体，便于定位「切到群聊就提示操作失败」到底是哪一步失败
        console.error(
          "[群详情] GET /group/" + groupId + " 失败:",
          error?.response?.status,
          error?.response?.data,
        );
        message.error(getErrorMessage(error, "操作失败"));
      }
    }

    // 重置 UI 状态
    resetBotThinking();
    showAllMembers.value = false;
    isEditingRule.value = false;
    tempGroupRule.value = newVal.groupRule || "";
    tempRemark.value = newVal.remark || "";
    scrollToBottom();
    showSearchPanel.value = false;
    clearSearch();
    if (messageTextareaRef.value) {
      messageTextareaRef.value.focus();
    }
    if (showContactDrawer.value) {
      updateRemarkPlaceholder(remarkEditableRef, activeContact);
    }
  },
  { immediate: true, deep: true },
);

// 添加监听器，当活动联系人变化时更新置顶和免打扰状态
watch(
  activeContact,
  (newContact) => {
    if (newContact) {
      isTop.value = newContact.isTop || false;
      isMuted.value = newContact.isMuted || false;
    } else {
      isTop.value = false;
      isMuted.value = false;
    }
  },
  { immediate: true },
);

// 监听选中联系人ID变化 - 更新备注占位符
watch(
  () => props.activeContactId,
  (newActiveContactId: any) => {
    if (newActiveContactId && remarkEditableRef.value && activeContact.value) {
      updateRemarkPlaceholder({ value: remarkEditableRef.value }, { value: activeContact.value });
    }
  },
  { immediate: true },
);

// 监听联系人抽屉显示状态 - 打开时更新备注占位符
watch(showContactDrawer, async (newVal: any) => {
  if (newVal && activeContact.value) {
    await nextTick();
    updateRemarkPlaceholder({ value: remarkEditableRef.value }, { value: activeContact.value });
  }
});

// 监听主题色变化
watch(
  () => siderColorStore.currentColorPalette,
  () => {},
  { deep: true },
);

// 监听用户信息变化
watch(
  () => userStore.user,
  () => {
    if (!isMounted.value) return;
  },
  { deep: true, immediate: true },
);

// 监听用户头像变化 - 更新用户信息
watch(
  () => userStore.userAvatar,
  (newAvatar: any) => {
    if (!isMounted.value) return;
    userInfo.avatar = newAvatar || "";
  },
  { immediate: true },
);

// 监听消息列表变化 - 自动滚动到底部
watch(
  () => activeContact.value?.messages,
  () => {
    if (isMounted.value && activeContact.value) {
      scrollToBottom();
    }
  },
  { deep: true },
);

// 群聊邀请类型枚举
const GROUP_INVITE_TYPES = {
  PENDING: "group_invite_pending",
  REJECTED: "group_invite_reject",
  ACCEPTED: "group_invite_accepted",
} as const;

type GroupInviteType = (typeof GROUP_INVITE_TYPES)[keyof typeof GROUP_INVITE_TYPES];

// 群聊邀请通知数据接口
interface GroupInviteNotification {
  type: "pending" | "rejected" | "accepted";
  groupId: number | string;
  groupName: string;
  groupNumber: string;
  groupAvatar?: string;
  isPrivate?: boolean;
  maxMembers?: number;
  rule?: string;
  requireApproval?: boolean;
  inviter: {
    id: number | string;
    username?: string;
    nickname?: string;
    avatar?: string;
  };
  invitee?: {
    id: number | string;
    username?: string;
    nickname?: string;
  };
  memberCount: number;
  createdAt: string;
  expiresAt?: string;
  description: {
    title: string;
    message: string;
  };
}

// 解析群聊邀请通知 - 优化版本
const parseGroupInviteNotification = (content: string): GroupInviteNotification | null => {
  try {
    const data = JSON.parse(content);
    const messageType = data.type || data.messageType;

    // 统一类型映射
    const typeMapping: Record<GroupInviteType, "pending" | "rejected" | "accepted"> = {
      [GROUP_INVITE_TYPES.PENDING]: "pending",
      [GROUP_INVITE_TYPES.REJECTED]: "rejected",
      [GROUP_INVITE_TYPES.ACCEPTED]: "accepted",
    };

    // 检查是否为有效的群聊邀请类型
    if (!Object.values(GROUP_INVITE_TYPES).includes(messageType as GroupInviteType)) {
      return null;
    }

    // 构建基础通知数据
    const baseNotification: Omit<GroupInviteNotification, "type" | "description"> = {
      groupId: data.groupId,
      groupName: data.groupName || "未知群聊",
      groupNumber: data.groupNumber || "未知",
      groupAvatar: data.groupAvatar,
      isPrivate: data.isPrivate,
      maxMembers: data.maxMembers,
      rule: data.rule,
      requireApproval: data.requireApproval,
      inviter: {
        id: data.inviter?.id,
        username: data.inviter?.username,
        nickname: data.inviter?.nickname,
        avatar: data.inviter?.avatar,
      },
      invitee: data.invitee
        ? {
            id: data.invitee.id,
            username: data.invitee.username,
            nickname: data.invitee.nickname,
          }
        : undefined,
      memberCount: data.memberCount || 0,
      createdAt: data.createdAt,
      expiresAt: data.expiresAt,
    };

    // 根据不同类型返回不同的描述信息
    switch (messageType) {
      case GROUP_INVITE_TYPES.PENDING:
        return {
          ...baseNotification,
          type: "pending",
          description: {
            title: "群聊邀请",
            message: "邀请您加入群聊",
          },
        };

      case GROUP_INVITE_TYPES.REJECTED:
        return {
          ...baseNotification,
          type: "rejected",
          description: {
            title: "群聊邀请被拒绝",
            message: "您拒绝了该邀请",
          },
        };

      case GROUP_INVITE_TYPES.ACCEPTED:
        return {
          ...baseNotification,
          type: "accepted",
          description: {
            title: "群聊加入通知",
            message: "已加入群聊",
          },
        };

      default:
        return null;
    }
  } catch (error) {
    console.error("解析群聊邀请通知失败:", error);
    return null;
  }
};

// 处理置顶切换 - 调用工具函数并更新状态
const handleTopToggleLocal = async (val: boolean | string | number) => {
  if (!isMounted.value || !activeContact.value) return;
  await nextTick();

  // 更新本地状态
  isTop.value = typeof val === "boolean" ? val : Boolean(val);

  // 触发刷新事件，通知父组件更新数据
  emit("refreshContacts");

  showContactDrawer.value = false;
};

// 处理静音切换 - 调用工具函数并更新状态
const handleMuteToggleLocal = async (val: boolean | string | number) => {
  if (!isMounted.value || !activeContact.value) return;
  await nextTick();

  // 更新本地状态
  isMuted.value = typeof val === "boolean" ? val : Boolean(val);

  // 触发刷新事件，通知父组件更新数据
  emit("refreshContacts");

  showContactDrawer.value = false;
};

// 备注编辑聚焦事件处理
const handleRemarkFocusLocal = (e: FocusEvent) => {
  if (!activeContact.value) return;
  handleRemarkFocus(e, getOptions.value);
  updateRemarkPlaceholder({ value: remarkEditableRef.value }, { value: activeContact.value });
};

// 备注编辑输入事件处理
const handleRemarkInputLocal = (e: InputEvent) => {
  handleRemarkInput(e, getOptions.value);
};

// 备注编辑失焦事件处理
const handleRemarkBlurLocal = (e: FocusEvent) => {
  handleRemarkBlur(e, getOptions.value);
};

// 备注编辑键盘事件处理
const handleRemarkKeyUpLocal = (e: KeyboardEvent) => {
  handleRemarkKeyUp(e, getOptions.value);
};

// 编辑群公告 - 初始化编辑状态
const handleEditRule = () => {
  if (!activeContact.value) return;
  tempGroupRule.value = activeContact.value.groupRule || "";
  isEditingRule.value = true;
};

// 保存群公告 - 调用工具函数
const saveGroupRuleLocal = () => {
  saveGroupRule(getOptions.value);
};

// 处理更多操作命令 - 调用工具函数
const handleMoreActionCommandLocal = async (command: string) => {
  if (!activeContact.value) {
    message.error("未选择联系人");
    return;
  }
  // 关闭弹窗
  showContactDrawer.value = false;
  await handleMoreActionCommand(command, getOptions.value);
};

// 消息输入框输入事件处理 - 更新响应式变量
const handleInputLocal = (e: InputEvent) => {
  if (messageTextareaRef.value) {
    newMessage.value = messageTextareaRef.value.innerText || "";
  }
};

// 处理搜索结果回调 - 更新搜索状态和UI
const handleSearchHistoryResult = (keyword: string, results: any) => {
  searchKeyword.value = keyword;
  searchResults.value = results.messages || [];
  hasSearched.value = true;
  showSearchPanel.value = true;
  currentSearchPage.value = 1;
};

// 暴露组件方法供父组件调用
defineExpose({
  scrollToBottom,
  updateRemarkPlaceholder,
  closeContactDrawer,
  updateContactOnlineStatus: (isOnline: boolean) => {
    // 触发响应式更新 - activeContact 是 computed，依赖 props.contacts
    // 父组件 message.vue 已经更新了 contacts 数组，这里只需要强制触发视图更新
  },
});

// 判断是否需要显示消息时间戳 - 间隔超过5分钟显示
const shouldShowTimeStamp = (message: ChatMessage, index: number): boolean => {
  return useShouldShowTimeStamp(message, index, activeContact.value?.messages || []);
};

// 页面显示判断 - 抽取所有v-if判断
const showJoinGroupNotice = computed(() => {
  // 只有在群聊中且存在入群记录时才显示
  if (!activeContact.value?.isGroup) return false;

  // 以入群通知数量为准：
  //   优先后端群详情的 joinNotices（含全部历史记录），回退前端反解的 joinMessages。
  //   不要求「消息列表里存在 group_notification」——那是发给邀请者的，
  //   被邀请进群的人消息列表里没有，加这个条件会导致被邀请者看不到入群通知。
  return joinNoticeSource.value.length > 0;
});
const showGroupRuleSection = computed(
  () => activeContact.value?.isGroup && (activeContact.value.groupRule || tempGroupRule.value),
);
const showGroupMembersSection = computed(
  () => activeContact.value?.isGroup && !!activeContact.value.groupMembers,
);
const showRemarkEditItem = computed(() => !isSelfChat.value || activeContact.value?.isGroup);

// 新增：是否有选中的媒体文件（图片或视频）
const hasSelectedMedia = computed(() => {
  return selectedImages.value.length > 0 || selectedVideos.value.length > 0;
});

// 新增：是否有选中的文件
const hasSelectedFiles = computed(() => {
  return selectedFiles.value.length > 0;
});

// 计算属性 - 发送按钮是否禁用（新增 readonly 和 blocked 判断）
const isSendButtonDisabled = computed(() => {
  return (
    props.readonly ||
    isBlocked.value ||
    (!newMessage.value.trim() && !hasSelectedMedia.value && !hasSelectedFiles.value)
  );
});

// 十六进制颜色转RGB函数
const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : "22, 93, 255";
};

// 合并选中的媒体列表
const selectedMediaList = computed(() => [
  ...selectedImages.value.map((item) => ({ ...item, type: "image" as const })),
  ...selectedVideos.value.map((item) => ({ ...item, type: "video" as const })),
]);

// 处理视频悬停播放
const playVideoOnHover = (event: Event) => {
  const videoElement = event.target as HTMLVideoElement;
  if (videoElement) {
    // 设置较小的播放速度，避免预览视频播放声音干扰
    videoElement.playbackRate = 0.5;
    videoElement.play().catch((error) => {
      // 捕获可能的播放错误，例如浏览器不允许自动播放
      console.log("视频播放失败:", error);
    });
  }
};

// 处理视频离开暂停
const pauseVideoOnLeave = (event: Event) => {
  const videoElement = event.target as HTMLVideoElement;
  if (videoElement) {
    videoElement.pause();
    // 重置播放时间为0，这样每次悬停都是从头开始播放
    videoElement.currentTime = 0;
  }
};

// 处理联系人抽屉相关的事件
const emitEditRemark = (contactId: string | number, newRemark: string) => {
  console.log("emitEditRemark被调用:", { contactId, newRemark });
  emit("editRemark", contactId, newRemark);
};

const handleClearChatLocal = (contactId: string | number) => {
  console.log("handleClearChatLocal被调用:", contactId);
  emit("clearChat", contactId);
};

const handleDeleteFriendLocal = (contactId: string | number) => {
  console.log("handleDeleteFriendLocal被调用:", contactId);
  emit("deleteFriend", contactId);
  showContactDrawer.value = false;
};

const handleDissolveGroupLocal = (groupId: string) => {
  console.log("handleDissolveGroupLocal被调用:", groupId);
  emit("dissolveGroup", groupId);
  showContactDrawer.value = false;
};

const handleQuitGroupLocal = (groupId: string | number) => {
  console.log("handleQuitGroupLocal被调用:", groupId);
  emit("quitGroup", String(groupId));
  showContactDrawer.value = false;
};

const handleUpdateGroupRuleLocal = (groupId: string | number, rule: string) => {
  console.log("handleUpdateGroupRuleLocal被调用:", { groupId, rule });
  emit("updateGroupRule", String(groupId), rule);
  showContactDrawer.value = false;
};

const handleDeleteTemporaryContactLocal = (contactId: string | number) => {
  console.log("handleDeleteTemporaryContactLocal被调用:", contactId);
  emit("deleteTemporaryContact", contactId);
  showContactDrawer.value = false;
};

// 处理联系人抽屉中的更新事件
const handleUpdateContactFromDrawer = async (contact: Contact) => {
  console.log("handleUpdateContactFromDrawer 被调用:", contact);
  // 🔥 刷新双向拉黑状态
  if (!contact.isGroup && contact.id) {
    try {
      const response = await request.get(`/blocked-users/${contact.id}/is-blocked`);
      const data = response.data;
      if (data.hasOwnProperty("iBlockedThem")) {
        iBlockedThem.value = data.iBlockedThem || false;
        theyBlockedMe.value = data.theyBlockedMe || false;
      } else {
        iBlockedThem.value = data.isBlocked || false;
        theyBlockedMe.value = false;
      }
    } catch (error) {
      console.error("刷新拉黑状态失败:", error);
    }
  }
  emit("refreshContacts");
};

// 添加新的事件处理函数
const handleMessageCopy = (message: any) => {
  console.log("复制消息:", message);
  // 这里可以添加复制消息的具体实现
};

const handleMessageRecall = async (message: any, originalContent?: string, recalledAt?: string) => {
  try {
    if (!activeContact.value) return;

    // 查找对应的消息并更新为已撤回状态
    // （id 在「乐观发送 temp_字符串」和「服务端数字 id」之间不统一，统一按字符串比较）
    const targetMessage = activeContact.value.messages.find(
      (msg: ChatMessage) => String(msg.id) === String(message?.id),
    );

    // 使用后端返回的时间，如果没有则使用当前时间
    const recallTime = recalledAt || new Date().toISOString();

    if (targetMessage) {
      // 先做一次本地乐观更新，撤回提示立即出现，不用等网络
      targetMessage.isRecalled = true;
      targetMessage.recalledAt = recallTime;
      targetMessage.recalledContent = originalContent || message.content; // 保存原始内容
      targetMessage.content = ""; // 清空内容，避免渲染空气泡
    }

    // 更新联系人的最后一条消息，确保联系人列表显示撤回提示
    // 用 formatMessageContent 生成与列表刷新后完全一致的撤回文案（走自定义撤回文案，且绝不泄漏原内容）
    const recallMessage = formatMessageContent(
      "text",
      "",
      !!activeContact.value.isGroup,
      targetMessage?.sender ?? message?.sender,
      true,
      String(props.currentUserId),
      targetMessage?.senderId ?? message?.senderId,
    );
    updateContactLastMessage(props.contacts, activeContact.value.id, recallMessage, recallTime);

    // 🔥 以服务端为准重取一次聊天记录：
    // 撤回后只靠本地 mutation 不保险（联系人对象/messages 数组会被后续刷新替换），
    // 与「删除撤回消息」路径保持一致（MessageDisplay 里同时 emit refresh-messages + refresh-contacts）。
    await refreshChatHistory();

    // 发射 refreshContacts 事件，通知父组件更新联系人列表（forceRefresh 绕过缓存，避免摘要被旧缓存覆盖）
    emit("refreshContacts", true);

    message.success("消息已撤回");
  } catch (error: any) {
    console.error("撤回消息失败:", error);
    message.error(error.response?.data?.message || "撤回消息失败");
  }
};

// ==================== 转发 ====================
const showForwardModal = ref(false);
const forwarding = ref(false);
/** 待转发的消息（单条右键转发长度为 1，多选批量转发为多条） */
const forwardTargetMessages = ref<ChatMessage[]>([]);

const openForwardModal = (list: ChatMessage[]) => {
  if (!list.length) return;
  forwardTargetMessages.value = list;
  showForwardModal.value = true;
};

/** 右键菜单「转发」：单条转发 */
const handleMessageForward = (msg: ChatMessage) => {
  if (!msg) return;
  openForwardModal([msg]);
  // 弹窗打开后顺手关掉右键菜单，避免两层叠加
  closeContextMenu();
};

/** 多选工具栏「转发」：批量转发 */
const handleForwardMessages = (list: ChatMessage[]) => {
  if (!list?.length) {
    message.warning("请先选择要转发的消息");
    return;
  }
  openForwardModal(list);
};

/** 确认转发：把所有待发消息发到选中的会话 */
const handleForwardConfirm = async (targetIds: (string | number)[]) => {
  const list = forwardTargetMessages.value;
  if (!list.length || !targetIds.length) return;

  forwarding.value = true;
  try {
    const { success, failed } = await forwardMessagesToTargets(list, targetIds, {
      contacts: props.contacts,
      currentUserId: props.currentUserId,
      userStore,
      rightChatAreaRef: { value: { scrollToBottom } },
    });

    if (success && !failed) {
      message.success(
        `已转发 ${list.length} 条消息到 ${targetIds.length} 个会话`,
      );
    } else if (success) {
      message.warning(`转发完成：成功 ${success} 项，失败 ${failed} 项`);
    } else {
      message.error("转发失败，请稍后重试");
    }

    showForwardModal.value = false;
    forwardTargetMessages.value = [];
    // 批量转发结束后退出多选模式
    if (list.length > 1) {
      isMultiSelectMode.value = false;
    }
  } catch (e) {
    console.error("转发失败:", e);
    message.error("转发失败，请稍后重试");
  } finally {
    forwarding.value = false;
  }
};

/** 群聊中 @Ta：把「@昵称 」插入输入框并聚焦 */
const handleMentionUser = (displayName: string) => {
  if (!displayName) return;
  const inputArea = messageInputAreaRef.value;
  // 先聚焦，保证 selection 落在输入框内，避免 @ 被插到别的位置
  inputArea?.messageTextareaRef?.focus();
  inputArea?.handleInsertEmoji?.(`@${displayName} `);
  nextTick(() => {
    inputArea?.messageTextareaRef?.focus();
  });
};

const handleMessageDelete = async (message: any) => {
  try {
    if (!activeContact.value) return;

    // 从联系人消息列表中删除该消息
    const messageIndex = activeContact.value.messages.findIndex(
      (msg: ChatMessage) => msg.id === message.id,
    );

    if (messageIndex > -1) {
      activeContact.value.messages.splice(messageIndex, 1);

      // 关键修复：更新联系人的最后一条消息和时间
      const messages = activeContact.value.messages;
      if (messages && messages.length > 0) {
        // 获取最后一条消息
        const lastMsg = messages[messages.length - 1];
        const lastMessageText = lastMsg.content || "";
        const lastMessageTime = lastMsg.time || new Date().toISOString();

        updateContactLastMessage(
          props.contacts,
          activeContact.value.id,
          lastMessageText,
          lastMessageTime,
        );
      } else {
        // 如果没有消息了，清空最后一条消息
        updateContactLastMessage(props.contacts, activeContact.value.id, "", "");
      }

      // 发射 refreshContacts 事件，通知父组件更新联系人列表（forceRefresh 绕过缓存，避免摘要被旧缓存覆盖）
      emit("refreshContacts", true);

      message.success("消息已删除");
    }
  } catch (error: any) {
    console.error("删除消息失败:", error);
    message.error("删除消息失败");
  }
};

// 处理重新编辑撤回的消息
const handleReEditMessage = (content: string) => {
  // 将撤回的内容设置到输入框
  newMessage.value = content;

  // 聚焦输入框
  nextTick(() => {
    if (messageInputAreaRef.value?.messageTextareaRef) {
      const textarea = messageInputAreaRef.value.messageTextareaRef;
      textarea.innerText = content;
      textarea.focus();

      // 将光标移动到文本末尾
      const range = document.createRange();
      const selection = window.getSelection();
      if (selection) {
        range.selectNodeContents(textarea);
        range.collapse(false); // 折叠到末尾
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  });
};

// 处理重新编辑撤回的图片消息
const handleReEditImage = async (imageUrl: string) => {
  try {
    // 从 URL 获取图片并转换为 File 对象
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const file = new File([blob], "re-edit-image.jpg", { type: blob.type });

    // 创建预览 URL
    const previewUrl = URL.createObjectURL(blob);

    // 构建图片对象
    const imageObj = {
      id: `reedit_${Date.now()}`,
      previewUrl,
      file,
      isScreenshot: false,
      mediaType: "image" as const,
    };

    // 添加到选中的图片列表
    selectedImages.value.push(imageObj);

    // 聚焦输入框
    nextTick(() => {
      if (messageInputAreaRef.value?.messageTextareaRef) {
        messageInputAreaRef.value.messageTextareaRef.focus();
      }
    });

    message.success("已添加撤回的图片，可直接发送");
  } catch (error) {
    console.error("重新编辑图片失败:", error);
    message.error("重新编辑图片失败");
  }
};

// 处理重新编辑撤回的视频消息
const handleReEditVideo = async (videoUrl: string) => {
  try {
    // 从 URL 获取视频并转换为 File 对象
    const response = await fetch(videoUrl);
    const blob = await response.blob();
    const file = new File([blob], "re-edit-video.mp4", { type: blob.type });

    // 创建预览 URL
    const previewUrl = URL.createObjectURL(blob);

    // 构建视频对象（添加必需的 tempFilename 字段）
    const videoObj = {
      id: `reedit_${Date.now()}`,
      previewUrl,
      file,
      tempFilename: `re-edit-video-${Date.now()}.mp4`,
      uploadProgress: undefined,
      isUploading: false,
      mediaType: "video" as const,
    };

    // 添加到选中的视频列表
    selectedVideos.value.push(videoObj);

    // 聚焦输入框
    nextTick(() => {
      if (messageInputAreaRef.value?.messageTextareaRef) {
        messageInputAreaRef.value.messageTextareaRef.focus();
      }
    });

    message.success("已添加撤回的视频，可直接发送");
  } catch (error) {
    console.error("重新编辑视频失败:", error);
    message.error("重新编辑视频失败");
  }
};

// 处理引用（回复）消息 - 设置引用目标，输入区显示引用预览条
const handleMessageReply = (message: ChatMessage) => {
  if (!message) return;
  replyTarget.value = message;
};

// 关闭右键菜单
const closeContextMenu = () => {
  contextMenuVisible.value = false;
  selectedMessage.value = null;
  selectedBubbleElement.value = null; // 清空气泡元素引用
};

// 处理右键菜单显示
const handleContextMenuShow = (event: MouseEvent, message: ChatMessage) => {
  event.preventDefault();
  event.stopPropagation();

  selectedMessage.value = message;

  // 🔥 简化：直接使用鼠标点击位置，不需要复杂计算
  const x = event.clientX;
  const y = event.clientY;

  contextMenuPosition.value = { x, y };

  // 显示菜单
  contextMenuVisible.value = true;
};

// 处理添加好友 - 从用户信息模态框触发
const handleAddFriendFromProfile = (userId: number) => {
  addFriendUserId.value = userId;
  showAddFriendModal.value = true;
};

// 处理发送消息 - 从用户信息模态框触发
const handleSendMessageFromProfile = (payload: { userId: number; userInfo?: any }) => {
  // 直接转发到父组件，统一由页面层处理临时会话和联系人创建
  emit("send-message", payload);
};

// 处理举报 - 从用户信息模态框触发
const handleReportFromProfile = (userId: number) => {
  // 根据 userId 查找对应的联系人
  const contact = props.contacts.find(
    (c) =>
      (c.isGroup === false && String(c.id) === String(userId)) ||
      (c.isGroup && c.owner?.id === String(userId)),
  );

  if (contact) {
    reportContactData.value = contact;
    showReportModal.value = true;
  } else {
    message.warning("未找到对应的联系人信息");
  }
};

// 🔥 文件预览相关处理函数

// 处理文件消息点击 - 打开文件预览
const handleFileMessageClick = (msg: ChatMessage) => {
  if (msg.messageType !== "file") return;

  try {
    const content = typeof msg.content === "string" ? JSON.parse(msg.content) : msg.content;

    previewFileInfo.value = {
      url: content.url || "",
      filename: content.filename || "未知文件",
      size: content.size || 0,
      type: getFileExtension(content.filename || ""),
    };

    showFilePreview.value = true;
  } catch (error) {
    console.error("解析文件消息失败:", error);
    message.error("文件信息解析失败");
  }
};

// 处理文件下载
const handleDownloadFile = (fileInfo: { url: string; filename: string }) => {
  if (!fileInfo.url) {
    message.warning("文件链接无效");
    return;
  }

  // 创建 a 标签下载
  const link = document.createElement("a");
  link.href = fileInfo.url;
  link.download = fileInfo.filename;
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  message.success("开始下载文件");
};

// 获取文件扩展名
const getFileExtension = (filename: string): string => {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "unknown";
};
</script>

<style lang="scss" scoped>
@use "../assets/scss/rightchat.scss";

/* ==================== 群聊风险提示横幅（QQ 式安全提醒） ==================== */
.group-risk-banner {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 8px 14px;
  font-size: 12.5px;
  line-height: 1.4;
  color: #b45309;
  background: rgba(245, 158, 11, 0.12);
  border-bottom: 1px solid rgba(245, 158, 11, 0.22);

  .risk-banner-icon {
    flex-shrink: 0;
    font-size: 14px;
    color: #f59e0b;
  }

  .risk-banner-text {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .risk-banner-link {
    flex-shrink: 0;
    padding: 0;
    font-size: 12.5px;
    color: #d97706;
    background: transparent;
    border: none;
    text-decoration: underline;
    cursor: pointer;

    &:hover {
      color: #b45309;
    }
  }

  .risk-banner-close {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    padding: 0;
    font-size: 12px;
    color: #b45309;
    background: transparent;
    border: none;
    border-radius: 50%;
    cursor: pointer;
    opacity: 0.7;

    &:hover {
      opacity: 1;
      background: rgba(180, 83, 9, 0.12);
    }
  }

  /* 分级配色：风险越高越偏红 */
  &.warning {
    color: #c2410c;
    background: rgba(249, 115, 22, 0.12);
    border-bottom-color: rgba(249, 115, 22, 0.22);

    .risk-banner-icon,
    .risk-banner-link {
      color: #f97316;
    }
  }

  &.high {
    color: #b91c1c;
    background: rgba(239, 68, 68, 0.12);
    border-bottom-color: rgba(239, 68, 68, 0.22);

    .risk-banner-icon,
    .risk-banner-link {
      color: #ef4444;
    }
  }

  &.severe {
    color: #991b1b;
    background: rgba(220, 38, 38, 0.14);
    border-bottom-color: rgba(220, 38, 38, 0.26);

    .risk-banner-icon,
    .risk-banner-link {
      color: #dc2626;
    }
  }
}
</style>
