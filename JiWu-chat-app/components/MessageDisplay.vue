<template>
  <div
    class="chat-session-section"
    :class="{ 'has-dynamic-bg': siderColorStore.hasDynamicBackground }"
    :style="chatSectionStyle"
  >
    <!-- 消息滚动区外层：用于承载"滚动条 hover 区" -->
    <div class="messages-scroll-host">
      <!-- 消息列表容器 -->
      <div
        class="messages-container"
        ref="messagesContainerRef"
        :style="{ height: '100%', overflowY: 'auto' }"
        @scroll="handleScroll"
      >
        <!-- 消息加载中（切换会话 / 首次进入 / 加载更多历史，统一提示） -->
        <div v-if="showLoadingHint" class="loading-more-history">
          <LoadingOutlined spin />
          <span>正在加载历史消息…</span>
        </div>

        <!-- 消息列表：会话加载中时隐藏，避免「记录已出现但仍在转圈」 -->
        <div v-if="!isSessionLoading && activeContact && displayMessages.length">
          <div
            v-for="(message, index) in displayMessages"
            :key="message.id || index"
            class="message-wrapper"
            :class="{
              'selected-message':
                isMultiSelectMode && message.id && selectedMessageIds.has(message.id),
              'has-checkbox':
                isMultiSelectMode && !message.isRecalled && !isJoinNoticeMessage(message),
              'my-message-wrapper': (isSelfChat || message.isMe) && !message.isRecalled,
              'recalled-message-wrapper': message.isRecalled,
              'sending-message': message.status === 'sending',
              'failed-message': message.status === 'failed',
            }"
            :id="`message-${message.id}`"
          >
            <!-- 入群通知：按入群时间插入到消息流对应位置，居中显示 -->
            <div v-if="isJoinNoticeMessage(message)" class="join-group-notice-wrapper">
              <div class="join-group-time" :style="chatFontStyle">
                {{ message.time }}
              </div>
              <div class="join-group-text">
                <span class="join-tag join-tag-new">{{ message.content }}</span>
              </div>
            </div>

            <!-- 普通消息 -->
            <template v-else>
              <!-- 新消息分割线 - 仅在群聊中显示 -->
              <div
                v-if="
                  activeContact?.isGroup &&
                  shouldShowNewMessageDivider(
                    message,
                    index,
                    displayMessages,
                    activeContact?.readCursor,
                  )
                "
                class="new-message-divider"
              >
                <div class="divider-line"></div>
                <span class="divider-text">新消息</span>
                <div class="divider-line"></div>
              </div>

              <!-- 多选复选框 -->
              <div
                v-if="isMultiSelectMode && !message.isRecalled"
                class="message-checkbox"
                @click.stop="toggleMessageSelection(message)"
              >
                <div
                  class="checkbox-circle"
                  :class="{
                    'checkbox-checked': message.id && selectedMessageIds.has(message.id),
                  }"
                >
                  <CheckOutlined
                    v-if="message.id && selectedMessageIds.has(message.id)"
                    class="checkmark-icon"
                  />
                </div>
              </div>

              <!-- 撤回消息 -->
              <div v-if="message.isRecalled" class="recalled-message-hint-wrapper">
                <div v-if="shouldShowTimeStampLocal(message, index)" class="message-timestamp">
                  {{ message.time }}
                </div>
                <div class="recalled-content-row">
                  <span class="recalled-text">{{ getRecallText(message) }}</span>
                  <span
                    v-if="
                      message.isMe &&
                      message.recalledContent &&
                      !['image', 'video', 'file'].includes(message.messageType || 'text')
                    "
                    class="re-edit-link"
                    @click.stop="handleReEditRecalledMessage(message)"
                  >
                    重新编辑
                  </span>
                  <i
                    v-if="message.isMe"
                    class="iconfont icon-guanbi delete-recalled-btn"
                    @click.stop="handleDeleteRecalledMessage(message)"
                  ></i>
                </div>
              </div>

              <!-- 正常消息时间戳 -->
              <template v-else>
                <div v-if="shouldShowTimeStampLocal(message, index)" class="message-timestamp">
                  {{ message.time }}
                </div>
              </template>

              <!-- 消息主体 -->
              <div
                class="message-item"
                :class="{ 'my-message': isSelfChat || message.isMe }"
                v-if="!message.isRecalled"
              >
                <!-- 头像 -->
                <a-avatar
                  :size="36"
                  :src="getMessageAvatar(message)"
                  class="message-avatar"
                  style="cursor: pointer; flex-shrink: 0"
                  @click="handleAvatarClick(message)"
                  @contextmenu="handleAvatarContextMenu($event, message)"
                />

                <!-- 消息内容区 -->
                <div class="message-content" @contextmenu="handleContextMenu($event, message)">
                  <!-- 群聊发送者名称 -->
                  <div v-if="activeContact?.isGroup" class="message-sender-name">
                    <span
                      v-if="getMessageLevelBadge(message)"
                      class="level-badge-combined"
                      :class="getLevelBadgeClass(message)"
                      @click="handleTitleClick(message)"
                    >
                      {{ getMessageLevelBadge(message) }}
                    </span>
                    <span class="sender-nickname">
                      {{
                        message.sender?.groupNickname ||
                        message.sender?.nickname ||
                        message.sender?.username
                      }}
                    </span>
                  </div>

                  <!-- 名片分享卡片 -->
                  <ShareCard v-if="isShareCard(message)" :message="message" />

                  <!-- 系统消息卡片 -->
                  <!-- 系统消息卡片：右键事件不再被 stop，直接冒泡到 .message-content，
                     与文本 / 图片 / 视频 / 文件 / 名片共用同一套右键菜单 -->
                  <SystemMessageCard
                    v-else-if="isSystemMessage(message)"
                    :message="message"
                    :current-user-id="currentUserId"
                    @open-detail="handleOpenSystemMessageDetail"
                  />

                  <!-- 消息气泡 -->
                  <div
                    v-else
                    class="message-bubble"
                    :class="{
                      'has-thinking': !!message.thinking,
                      'my-bubble': isSelfChat || message.isMe,
                      'other-bubble': !(isSelfChat || message.isMe),
                      'image-bubble': message.messageType === 'image',
                      'video-bubble': message.messageType === 'video',
                      'file-bubble': message.messageType === 'file',
                    }"
                    :style="getBubbleStyle(message)"
                    @click="handleMessageClick($event)"
                  >
                    <!-- AI 深度思考（机器人回复默认开启，点击展开思考过程） -->
                    <div
                      v-if="message.thinking"
                      class="deep-thinking-block"
                      :class="{ expanded: isThinkingExpanded(message) }"
                    >
                      <div
                        class="deep-thinking-header"
                        @click.stop="toggleThinking(message)"
                      >
                        <span class="deep-thinking-title">已深度思考</span>
                        <i
                          class="iconfont icon-jiantou_down deep-thinking-arrow"
                          :class="{ 'arrow-rotated': isThinkingExpanded(message) }"
                        ></i>
                      </div>
                      <div
                        v-if="isThinkingExpanded(message)"
                        class="deep-thinking-body"
                      >
                        {{ message.thinking }}
                      </div>
                    </div>

                    <!-- 引用回复头部 -->
                    <div v-if="message.replyTo" class="reply-quote-header" @click.stop>
                      <span class="reply-quote-sender">{{
                        message.replyTo.senderName || "对方"
                      }}</span>
                      <span class="reply-quote-content">{{
                        getReplyQuotePreview(message.replyTo)
                      }}</span>
                    </div>

                    <!-- 图片消息 -->
                    <div v-if="message.messageType === 'image'" class="message-image-container">
                      <img
                        :src="message.content"
                        class="message-image"
                        loading="lazy"
                        alt="图片"
                        @click.stop="handleImageClick($event)"
                        @dblclick.stop="previewImage(message.content)"
                        @error="(e) => handleImageError(e, message)"
                      />
                    </div>

                    <!-- 视频消息 -->
                    <div
                      v-else-if="message.messageType === 'video'"
                      class="message-video-container"
                    >
                      <video
                        :src="message.content"
                        class="message-video"
                        disablePictureInPicture
                        loading="lazy"
                        loop
                        @click.stop="handleVideoClick($event)"
                        @dblclick.stop="previewVideo(message.content)"
                        @mouseenter="playVideoOnHover($event)"
                        @mouseleave="pauseVideoOnLeave($event)"
                        @error="(e) => handleVideoError(e, message)"
                      >
                        你的浏览器不支持视频播放
                      </video>
                    </div>

                    <!-- 文件消息 -->
                    <div
                      v-else-if="message.messageType === 'file'"
                      class="message-file-container"
                      @click.stop="handleFileClick(message)"
                    >
                      <div class="file-icon-wrapper">
                        <i :class="getFileIconClass(message)" class="file-icon"></i>
                      </div>
                      <div class="file-info">
                        <div class="file-name" :title="getFileName(message)">
                          {{ getFileName(message) }}
                        </div>
                        <div class="file-meta">
                          <span class="file-size">{{ formatMessageFileSize(message) }}</span>
                          <span class="file-type">{{ getFileTypeLabel(message) }}</span>
                        </div>
                      </div>
                    </div>

                    <!-- 系统文本消息 -->
                    <div
                      v-else-if="message.messageType === 'system'"
                      class="system-message-content"
                    >
                      {{ message.content }}
                    </div>

                    <!-- 通话消息 -->
                    <div v-else-if="message.messageType === 'call'" class="call-message-content">
                      <div class="call-info-row">
                        <i
                          class="iconfont call-type-icon"
                          :class="
                            message.callType === 'video'
                              ? 'icon-shipintonghua'
                              : 'icon-yuyintonghua'
                          "
                        ></i>
                        <span class="call-status-text">{{ message.content }}</span>
                        <template
                          v-if="
                            message.callStatus === 'missed' ||
                            message.callStatus === 'cancelled' ||
                            message.callStatus === 'rejected'
                          "
                        >
                          <span class="call-redial-inline" @click.stop="handleRedial(message)">
                            重拨
                          </span>
                        </template>
                      </div>
                    </div>

                    <!-- 普通文本消息（AI 回复逐字输出） -->
                    <div
                      v-else
                      class="text-message-content"
                      :class="{
                        'emoji-only-message': isOnlyEmoji(messageRenderContent(message)),
                      }"
                    >
                      <span
                        v-for="(segment, segmentIndex) in segmentHighlightedText(
                          messageRenderContent(message),
                          searchKeyword,
                        )"
                        :key="segmentIndex"
                        :class="{ highlight: segment.highlighted }"
                        >{{ segment.text }}</span
                      ><span
                        v-if="isStreamingMessage(message)"
                        class="bot-typing-cursor"
                        aria-hidden="true"
                      ></span>
                    </div>
                  </div>

                  <!-- 发送状态指示器 -->
                  <div
                    v-if="
                      message.isMe && (message.status === 'sending' || message.status === 'failed')
                    "
                    class="message-status-indicator"
                  >
                    <span v-if="message.status === 'sending'" class="sending-text">发送中...</span>
                    <span v-if="message.status === 'failed'" class="failed-text">发送失败</span>
                    <a-button
                      v-if="message.status === 'failed'"
                      size="small"
                      type="link"
                      @click="retrySendMessage(message)"
                      class="retry-button"
                    >
                      重试
                    </a-button>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- ✅ 自定义滚动条：只有鼠标经过这条窄边时才显示 -->
      <div
        class="scroll-hover-zone"
        @mouseenter="onScrollZoneEnter"
        @mouseleave="onScrollZoneLeave"
      >
        <div
          class="scroll-thumb"
          :class="{ 'is-visible': scrollbarVisible }"
          :style="scrollThumbStyle"
          @mousedown.prevent="startDragThumb"
        ></div>
      </div>
    </div>

    <!-- 多选底部工具栏 -->
    <div v-if="isMultiSelectMode" class="multi-select-bottom-bar">
      <div class="bottom-bar-content">
        <div class="selection-info">
          <span class="select-all-btn" @click.stop="handleSelectAll">
            {{ isAllSelected ? "取消全选" : "全选" }}
          </span>
          <span style="margin-left: 10px"> 已选择 {{ selectedMessageIds.size }} 条消息 </span>
        </div>
        <div class="bottom-actions right-actions">
          <div class="action-item cancel-action" @click="handleCancelMultiSelect">
            <i class="iconfont icon-guanbi1"></i>
          </div>
          <div
            class="action-item"
            :class="{ 'is-disabled': !hasSelection }"
            title="转发到其它会话"
            @click="handleForwardSelected"
          >
            <i class="iconfont icon-zhuanfa"></i>
          </div>
          <div
            class="action-item is-unsupported"
            title="收藏这条消息"
            @click="handleUnsupportedAction('收藏', '收藏功能正在开发中，敬请期待')"
          >
            <i class="iconfont icon-shoucang"></i>
          </div>
          <div
            class="action-item is-unsupported"
            title="合并转发"
            @click="handleUnsupportedAction('合并转发', '合并转发功能正在开发中，敬请期待')"
          >
            <i class="iconfont icon-hebingzhuanfa"></i>
          </div>
          <div
            class="action-item is-unsupported"
            title="分享给好友"
            @click="handleUnsupportedAction('分享', '分享功能正在开发中，敬请期待')"
          >
            <i class="iconfont icon-fenxiang"></i>
          </div>
          <div class="action-item danger" @click="handleBatchDelete">
            <i class="iconfont icon-shanchu"></i>
          </div>
        </div>
      </div>
    </div>

    <!-- 弹窗组件 -->
    <UserProfileModal
      :visible="userProfileModalVisible"
      :userId="userProfileModalUserId"
      :position="userProfileModalPosition"
      :anchor-x="userProfileModalAnchorX"
      :groupId="activeContact?.isGroup ? normalizeGroupNumericId(activeContact.id) : null"
      :current-user-id="currentUserId"
      @update:visible="userProfileModalVisible = $event"
      @add-friend="handleAddFriendFromProfile"
      @send-message="handleSendMessageFromProfile"
      @report="handleReportFromProfile"
    />

    <SystemMessageDetailModal
      :visible="systemMessageDetailVisible"
      :message="systemMessageDetailData"
      :current-user-id="currentUserId"
      @update:visible="systemMessageDetailVisible = $event"
      @close="handleSystemMessageDetailClose"
      @refresh-messages="emit('refresh-messages')"
      @refresh-contacts="emit('refresh-contacts')"
    />

    <GroupTitleModal
      :visible="groupTitleModalVisible"
      :userId="groupTitleModalUserId"
      :groupId="groupTitleModalGroupId"
      :current-title="groupTitleModalCurrentTitle"
      :username="groupTitleModalUsername"
      :user-avatar="groupTitleModalUserAvatar"
      :user-level="groupTitleModalUserLevel"
      @update:visible="groupTitleModalVisible = $event"
      @success="handleGroupTitleSuccess"
    />

    <!-- 头像右键菜单（仅群聊）：@Ta / 个人资料 -->
    <AvatarContextMenu
      :visible="avatarMenuVisible"
      :position="avatarMenuPosition"
      :display-name="avatarMenuTarget?.displayName || 'Ta'"
      :is-self="!!avatarMenuTarget?.isSelf"
      @close="closeAvatarMenu"
      @mention="handleAvatarMention"
      @view-profile="handleAvatarViewProfile"
    />

    <FilePreview
      v-if="filePreviewVisible && filePreviewData"
      :visible="filePreviewVisible"
      :file="filePreviewData"
      :file-list="filePreviewList"
      :current-index="filePreviewCurrentIndex"
      @close="handleFilePreviewClose"
      @update:current-index="filePreviewCurrentIndex = $event"
      @delete-file="handleDeleteFileFromPreview"
      @download="handleDownloadFileFromPreview"
    />
  </div>
</template>

<script setup lang="ts">
import { getErrorMessage } from "../untils/errorMessage";
import { ref, computed, nextTick, onMounted, watch, onUnmounted } from "vue";
import { message as antMessage, Modal } from "ant-design-vue";
import { CheckOutlined, LoadingOutlined } from "@ant-design/icons-vue";
import request from "../untils/request";
import { normalizeGroupNumericId } from "../composables/useGroupMembers";
import type { Contact, ChatMessage } from "../types/chatTypes";
import type { SelectedFile } from "../types/untilsTypes";
import { segmentHighlightedText } from "../untils/htmlSecurity";
import { shouldShowTimeStamp, shouldShowNewMessageDivider } from "../untils/rightchat";
import { useSiderColor } from "../stores/siderColor";
import { useUserStore } from "../stores/user";
import { useGroupLevelBadgeStore } from "../stores/groupLevelBadge";
// AvatarContextMenu 走 Nuxt 的 components 自动导入，与 ShareCard / SystemMessageCard 一致

import {
  getCustomRecallText,
  updateContactLastMessage,
  getChatHistory,
  formatMessageContent,
  getMessageTimestamp,
} from "../untils/contactManager";
import { getLevelTitle } from "../untils/levelUtils";
import {
  getFileExtension,
  getFileName,
  getFileIconClass,
  getFileTypeLabel,
  formatMessageFileSize,
  getMimeType,
} from "../untils/fileHandler";

const siderColorStore = useSiderColor();
const badgeStore = useGroupLevelBadgeStore();

// 系统消息类型列表
const SYSTEM_MESSAGE_TYPES = [
  "group_invite_pending",
  "group_invite_accepted",
  "group_invite_rejected",
  "group_notification",
];

// 判断是否为系统消息
const isSystemMessage = (message: ChatMessage): boolean => {
  if (!message || !message.messageType) {
    return false;
  }
  return SYSTEM_MESSAGE_TYPES.includes(message.messageType);
};

// 判断是否为名片分享消息
const isShareCard = (message: ChatMessage): boolean => {
  return message?.messageType === "share_user_card" || message?.messageType === "share_group_card";
};

// ============================================================
// Props 和 Emits
// ============================================================
interface Props {
  activeContact: Contact | null;
  showJoinGroupNotice?: boolean;
  joinMessageDisplayText?: string;
  joinNewMembers?: { userName: string; time?: string }[];
  isSelfChat: boolean;
  searchKeyword: string;
  contacts: Contact[];
  currentUserId: number;
  isMultiSelectMode?: boolean;
  /** 会话是否正在加载（切换联系人 / 首次进入时由父组件传入） */
  chatLoading?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showJoinGroupNotice: false,
  joinMessageDisplayText: "",
  joinNewMembers: () => [],
  contacts: () => [],
  currentUserId: 0,
  isMultiSelectMode: false,
  chatLoading: false,
});

const emit = defineEmits<{
  (e: "previewImage", imageUrl: string): void;
  (e: "previewVideo", videoUrl: string): void;
  (e: "previewFile", fileInfo: { url: string; filename: string; size: number; type: string }): void;
  (e: "playVideoOnHover", event: MouseEvent): void;
  (e: "pauseVideoOnLeave", event: MouseEvent): void;
  (e: "messageDeleted", message: ChatMessage): void;
  (e: "context-menu-show", event: MouseEvent, message: ChatMessage): void;
  (e: "context-menu-close"): void;
  (e: "show-add-friend-modal", userId: number): void;
  (e: "show-report-modal", contact: { id: number; isGroup: boolean }): void;
  (e: "contact-select", contactId: string): void;
  (e: "add-friend", userId: number): void;
  (e: "send-message", payload: { userId: number; userInfo: any }): void;
  (e: "report", userId: number): void;
  (e: "refresh-messages"): void;
  (e: "refresh-contacts", forceRefresh?: boolean): void;
  (e: "re-edit-message", content: string): void;
  (e: "re-edit-image", imageUrl: string): void;
  (e: "re-edit-video", videoUrl: string): void;
  (e: "toggle-multi-select-mode"): void;
  (e: "select-message", messageId: string | number): void;
  (e: "batch-delete"): void;
  (e: "redial-call", payload: { callType: string; contactId?: string | number }): void;
  (e: "delete-message", message: ChatMessage): void;
  (e: "recall-message", message: ChatMessage, originalContent?: string, recalledAt?: string): void;
  (e: "copy-message", message: ChatMessage): void;
  (e: "reply-message", message: ChatMessage): void;
  (e: "forward-message", message: ChatMessage): void;
  (e: "multi-select-message", message: ChatMessage): void;
  (e: "retry-send-message", message: ChatMessage): void;
  (e: "mention-user", displayName: string): void;
  (e: "forward-messages", messages: ChatMessage[]): void;
}>();

// ============================================================
// 主题样式相关
// ============================================================
const chatSectionStyle = computed(() => {
  const palette = siderColorStore.currentColorPalette;
  return {
    background: siderColorStore.hasDynamicBackground
      ? "transparent"
      : palette.chatBgGradient || `linear-gradient(180deg, ${palette.light} 0%, transparent 100%)`,
    "--theme-primary": palette.textPrimary || palette.color,
    "--theme-active": palette.active,
    "--theme-hover": palette.hover,
    "--theme-light": palette.light,
    "--chat-primary-color": palette.textPrimary || palette.color,
    "--chat-active-color": palette.active,
    "--chat-hover-color": palette.hover,
    // ✅ 气泡核心变量（无阴影）
    "--message-bubble-bg": siderColorStore.bubbleBg,
    "--message-bubble-border": siderColorStore.bubbleBorder,
    "--message-bubble-text": siderColorStore.bubbleTextColor,
    "--text-primary": siderColorStore.textPrimaryColor,
    "--text-secondary": siderColorStore.textSecondaryColor,
    "--bg-primary": siderColorStore.bgPrimaryColor,
    "--bg-tertiary": siderColorStore.bgTertiaryColor,
    "--border-light": siderColorStore.borderLightColor,
    "--border-normal": siderColorStore.borderNormalColor,
    "--tag-bg": siderColorStore.tagBgColor,
    "--tag-color": siderColorStore.tagTextColor,
    "--link-color": siderColorStore.linkColorValue,
    // 重新编辑链接的强调色：动态主题下吸取壁纸主色，非动态用主题链接色
    "--re-edit-accent": siderColorStore.hasDynamicBackground
      ? siderColorStore.dynamicAccent
      : siderColorStore.linkColorValue,
    "--danger-color": siderColorStore.dangerColorValue,
    "--highlight-bg": siderColorStore.highlightBgColor,
    "--highlight-color": siderColorStore.highlightColorValue,
    "--selected-bg": siderColorStore.selectedBgColor,
    "--primary-light": siderColorStore.primaryLightColor,
    "--scrollbar-track": siderColorStore.scrollbarTrackColor,
    "--scrollbar-thumb": siderColorStore.scrollbarThumbColor,
    // 分割线：动态主题下用从壁纸吸取的主色加深版，和联系人列表选中态一致且更醒目
    "--divider-line-color":
      (siderColorStore.hasDynamicBackground && siderColorStore.dynamicAccentDeep) ||
      siderColorStore.dividerLineColorValue,
    "--divider-text-color":
      (siderColorStore.hasDynamicBackground && siderColorStore.dynamicAccentDeep) ||
      siderColorStore.dividerTextColorValue,
  };
});

const chatFontStyle = computed(() => ({
  // 动态主题（个性装扮）下入群通知时间转白色，避免深色文字在壁纸上看不清
  color: siderColorStore.hasDynamicBackground
    ? "#ffffff"
    : siderColorStore.currentColorPalette.text,
}));

const currentColorPalette = computed(() => {
  return siderColorStore.currentColorPalette;
});

const isSelfChat = computed(() => props.isSelfChat);

/**
 * 群聊「入群 / 邀请」类消息类型。
 *
 * 这类消息在群聊里只作为「入群通知」的数据源：供 extractJoinMessages 提取 joinMessages，
 * 由消息列表顶部的「XXX 加入了群聊」提示条统一展示。
 * 它们不应在消息列表中再渲染成一张「群邀请卡片」。
 *
 * 背景：管理员同意加群申请后，后端会往群里写入一条 group_invite_accepted 消息，
 * 若原样渲染，群聊里就会出现一张群邀请卡片，而用户期望的是入群通知，不是卡片。
 */
const GROUP_INVITE_MESSAGE_TYPES = [
  "group_invite_pending",
  "group_invite_accepted",
  "group_invite_rejected",
];

/**
 * 入群通知数据源。
 *
 * 优先用后端群详情接口返回的 `joinNotices`（权威数据源，含该群全部历史入群记录），
 * 未升级 / 老数据时回退前端从聊天消息反解出的 `joinMessages`。
 */
const joinNoticeSource = computed<any[]>(() => {
  const contact = props.activeContact as any;
  if (!contact?.isGroup) return [];
  if (Array.isArray(contact.joinNotices) && contact.joinNotices.length > 0) {
    return contact.joinNotices;
  }
  return Array.isArray(contact.joinMessages) ? contact.joinMessages : [];
});

/** 是否为入群通知伪消息 */
const isJoinNoticeMessage = (m: ChatMessage): boolean => m?.messageType === "join_notice";

/**
 * 统一计算消息（含入群通知伪消息）的排序时间戳。
 * 优先级：_timestamp > createdAt > time（解析）。
 */
const getMsgSortTime = (m: any): number => {
  if (typeof m._timestamp === "number" && m._timestamp > 0) return m._timestamp;
  if (m.createdAt) {
    const t = new Date(m.createdAt).getTime();
    if (!isNaN(t)) return t;
  }
  return getMessageTimestamp(m.time || "") || 0;
};

/**
 * 入群通知伪消息列表：把每条入群记录转成一条「伪消息」，
 * 时间取 joinedAt（ISO，精确）优先、回退 time，用于按入群时间插入消息流。
 */
const joinNoticeMessages = computed<ChatMessage[]>(() => {
  const contact = props.activeContact as any;
  if (!contact?.isGroup) return [];
  const groupName = contact?.name || "";
  return joinNoticeSource.value
    .map((n: any, i: number) => {
      const userName = n.userName || "用户";
      const sortTime = getMessageTimestamp(n.joinedAt || n.time || "") || 0;
      return {
        id: `join-notice-${n.userId || i}-${i}`,
        messageType: "join_notice",
        content: `${userName} 加入了${groupName}`,
        time: n.time || n.joinedAt || "",
        isMe: false,
        isRecalled: false,
        _timestamp: sortTime || undefined,
      } as ChatMessage;
    })
    .filter((n) => !!n.content);
});

/**
 * 实际渲染的消息列表。
 *
 * 过滤规则：群聊中「发到群里的群邀请类消息」不渲染（仅用于生成入群通知）。
 * 私聊中的群邀请卡片（groupId 为空、发给被邀请者本人）仍需正常显示，故只在群聊里过滤。
 *
 * 入群通知按入群时间插入到消息流对应位置（不再固定顶部）。
 */
const displayMessages = computed<ChatMessage[]>(() => {
  const messages = props.activeContact?.messages || [];
  if (!props.activeContact?.isGroup) return messages;

  const filtered = messages.filter(
    (m) => !GROUP_INVITE_MESSAGE_TYPES.includes(String(m.messageType || "")),
  );

  const notices = joinNoticeMessages.value;
  if (!notices.length) return filtered;

  const merged = [...filtered, ...notices];
  merged.sort((a, b) => getMsgSortTime(a) - getMsgSortTime(b));
  return merged;
});

/**
 * 是否展示「正在加载历史消息…」提示。
 *   1) 切换会话 / 首次进入（父组件 chatLoading=true）→ 覆盖整片消息区；
 *   2) 向上滚动加载更多历史（loadingMoreHistory=true）→ 顶部提示条。
 */
const showLoadingHint = computed(() => {
  return props.chatLoading || loadingMoreHistory.value;
});

/**
 * 是否处于「切换会话 / 首次进入」的整片加载中。
 * 此状态下隐藏消息列表，只显示加载提示，避免「聊天记录已出现但仍在转圈」。
 *
 * 注意：向上滚动加载更多（loadingMoreHistory）不属于此列——
 * 那种情况要保留已有消息，只在顶部显示提示条。
 */
const isSessionLoading = computed(() => {
  return props.chatLoading && !loadingMoreHistory.value;
});

/** 颜色 → rgb 数组（支持 #rgb / #rrggbb / rgb() / rgba()） */
const toRgb = (color: string): [number, number, number] => {
  const c = (color || "").trim();
  if (c.startsWith("#")) {
    const hex = c.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ];
    }
    if (hex.length >= 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
      ];
    }
    return [139, 92, 246];
  }
  const m = c.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (m) {
    return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
  }
  return [139, 92, 246];
};

/** 相对亮度 0~255 */
const rgbLuminance = (rgb: [number, number, number]): number =>
  0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];

/**
 * 根据气泡底色自动选择文字颜色：浅底→接近纯黑，深底→纯白。
 * 修复「主题色偏浅（如默认 #DCDCDC）时，自己的气泡白字几乎看不见」的问题。
 */
const readableTextOn = (bg: string): string => {
  return rgbLuminance(toRgb(bg)) > 150 ? "#0A0A0A" : "#FFFFFF";
};

/**
 * 获取消息气泡样式（无阴影）。
 * 区分左右：自己的气泡（右侧）用主色，对方的气泡（左侧）用浅色底。
 * ✅ 文字色按底色亮度自动取深/浅，保证任何主题下都清晰可读。
 *
 * ⚠️ 夜间模式修复：日间主题的主色（如默认 #DCDCDC）偏浅，暗色调色板里
 * `palette.color` 仍保留原浅色（buildDarkPaletteFromLight 只换背景不换主色），
 * 导致「自己的气泡」在夜间依旧是浅灰底 + 深色字，既不是暗色、文字也不是白色。
 * 因此夜间模式下改用暗色气泡底（bubbleBg）并统一白字，仅用主色描边区分左右。
 *
 * ⚠️ 个性装扮（动态壁纸）主题：气泡不要任何底色 / 描边 / 毛玻璃，壁纸直接透出，
 * 文字统一用动态主题文字色 var(--dt-text)。
 */
const getBubbleStyle = (message: ChatMessage) => {
  const palette = currentColorPalette.value;
  const style: Record<string, string> = {};

  // 图片、视频、文件消息不应用气泡样式
  if (
    message.messageType === "image" ||
    message.messageType === "video" ||
    message.messageType === "file"
  ) {
    return style;
  }

  const isMe = isSelfChat.value || message.isMe;
  const isDynamic = siderColorStore.hasDynamicBackground;
  const isDark = !isDynamic && !!siderColorStore.systemPrefersDark;

  if (isDynamic) {
    // 动态壁纸主题：左右气泡**保持一致** —— 都用同一档「壁纸吸色 + 同色系半透明 + 细描边」，
    // 壁纸依旧透出来。此前右侧取主色、左侧取白色，左右看起来是两种气泡，观感割裂；
    // 现在左右只靠位置与头像区分。
    const [ar, ag, ab] = toRgb(siderColorStore.dynamicAccent || "#94A3B8");
    const accentTint = (alpha: number) => `rgba(${ar}, ${ag}, ${ab}, ${alpha})`;

    style.backgroundColor = accentTint(0.18);
    style.border = `1px solid ${accentTint(0.55)}`;
    style.boxShadow = "none";
    style.backdropFilter = "none";
    style.WebkitBackdropFilter = "none";
    style.color = "var(--dt-text)";
    style["--text-primary"] = "var(--dt-text)";
    style["--text-secondary"] = "var(--dt-text)";
  } else if (isDark) {
    // 夜间模式：左右统一暗色底 + 白字，保证「暗色气泡 + 白色文字」。
    // 聊天背景约 #0d0d0d，气泡需比背景略亮才能看清边界，但整体保持很暗。
    // 自己的气泡稍亮一档（#1a1a1a）以区分左右，对方更深（#141414）。
    style.backgroundColor = isMe ? "#1a1a1a" : "#141414";
    style.color = "#F5F5F5";
    // // 自己的气泡用主色描边区分，对方用浅白描边
    // style.border = isMe
    //   ? `1px solid ${palette.color || "rgba(255,255,255,0.35)"}`
    //   : "1px solid rgba(255, 255, 255, 0.06)";
  } else {
    const accent = palette.color || "#8b5cf6";
    const bg = siderColorStore.bubbleBg || palette.bubbleBg || palette.bgPrimary || "#FFFFFF";
    // const border =
    //   siderColorStore.bubbleBorder || `1px solid ${palette.borderLight || "rgba(0,0,0,0.08)"}`;
    // 极简白（默认 base 主题）：左右气泡统一用底色，仅靠左右位置/头像区分，保持极简观感；
    // 其它主题：自己的气泡用主色填充以区分左右。
    const isBaseTheme = siderColorStore.currentThemeType === "base";
    style.backgroundColor = isMe && !isBaseTheme ? accent : bg;
    // ✅ 浅底用深色字、深底用白字，彻底避免文字发灰看不清
    style.color = readableTextOn(style.backgroundColor);
    // style.border = border;
  }

  return style;
};

// ============================================================
// 状态管理
// ============================================================
const messagesContainerRef = ref<HTMLElement | null>(null);
const userProfileModalVisible = ref(false);
const userProfileModalUserId = ref<number | null>(null);
const userProfileModalPosition = ref<"left" | "right">("right");
const userProfileModalAnchorX = ref(0);
const systemMessageDetailVisible = ref(false);
const systemMessageDetailData = ref<ChatMessage | null>(null);
const selectedMessageIds = ref<Set<string | number>>(new Set());

// 滚动加载
const loadingMoreHistory = ref(false);
const hasMoreHistory = ref(true);
const currentPage = ref(1);
const scrollThreshold = 100;

// ============================================================
// ✅ 自定义滚动条状态（高性能版）
// ============================================================
const scrollbarVisible = ref(false); // 鼠标是否在滚动条 hover 区
const scrollThumbTop = ref(0); // 滑块 top（px）
const scrollThumbHeight = ref(0); // 滑块高度（px）
const hasScrollbar = ref(false); // 内容是否超出，需要滚动条

let draggingThumb = false;
let dragStartY = 0;
let dragStartScrollTop = 0;
let rafId: number | null = null; // 拖动用的 rAF 句柄
let syncRafId: number | null = null; // 同步用的 rAF 句柄

/** 同步滚动条几何（用 rAF 节流，避免滚动高频触发） */
const syncScrollbar = () => {
  if (syncRafId !== null) return;
  syncRafId = requestAnimationFrame(() => {
    syncRafId = null;
    const c = messagesContainerRef.value;
    if (!c) return;

    const { scrollTop, scrollHeight, clientHeight } = c;

    if (scrollHeight <= clientHeight) {
      hasScrollbar.value = false;
      scrollThumbHeight.value = 0;
      scrollThumbTop.value = 0;
      return;
    }

    hasScrollbar.value = true;

    const ratio = clientHeight / scrollHeight;
    const thumbH = Math.max(24, clientHeight * ratio);
    const maxTop = clientHeight - thumbH;
    const maxScroll = scrollHeight - clientHeight;
    const top = maxScroll > 0 ? (scrollTop / maxScroll) * maxTop : 0;

    // 只在变化时赋值，避免无意义响应式触发
    if (scrollThumbHeight.value !== thumbH) scrollThumbHeight.value = thumbH;
    if (scrollThumbTop.value !== top) scrollThumbTop.value = top;
  });
};

const scrollThumbStyle = computed(() => {
  if (!hasScrollbar.value) return { visibility: "hidden" as const, opacity: 0 };
  return {
    height: `${scrollThumbHeight.value}px`,
    transform: `translateY(${scrollThumbTop.value}px)`,
  };
});

/** 鼠标进入滚动条 hover 区 */
const onScrollZoneEnter = (e: MouseEvent) => {
  const related = e.relatedTarget as Node | null;
  if (related && (e.currentTarget as HTMLElement).contains(related)) return;
  if (!hasScrollbar.value) return;
  scrollbarVisible.value = true;
};

/** 鼠标离开滚动条 hover 区 */
const onScrollZoneLeave = (e: MouseEvent) => {
  const related = e.relatedTarget as Node | null;
  if (related && (e.currentTarget as HTMLElement).contains(related)) return;
  if (draggingThumb) return;
  scrollbarVisible.value = false;
};

/** 拖动滑块（rAF 节流） */
const startDragThumb = (e: MouseEvent) => {
  draggingThumb = true;
  scrollbarVisible.value = true;
  dragStartY = e.clientY;
  dragStartScrollTop = messagesContainerRef.value?.scrollTop || 0;

  document.body.style.userSelect = "none";
  window.addEventListener("mousemove", onDragThumb);
  window.addEventListener("mouseup", stopDragThumb);
};

const onDragThumb = (e: MouseEvent) => {
  if (!draggingThumb) return;
  if (rafId !== null) return;

  const clientY = e.clientY;
  rafId = requestAnimationFrame(() => {
    rafId = null;
    const c = messagesContainerRef.value;
    if (!c) return;

    const deltaY = clientY - dragStartY;
    const { scrollHeight, clientHeight } = c;
    const maxTop = clientHeight - scrollThumbHeight.value;
    if (maxTop <= 0) return;

    const maxScroll = scrollHeight - clientHeight;
    const scrollDelta = (deltaY / maxTop) * maxScroll;
    c.scrollTop = dragStartScrollTop + scrollDelta;
  });
};

const stopDragThumb = () => {
  draggingThumb = false;
  document.body.style.userSelect = "";
  window.removeEventListener("mousemove", onDragThumb);
  window.removeEventListener("mouseup", stopDragThumb);
  if (rafId !== null) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
};

// 群头衔弹窗
const groupTitleModalVisible = ref(false);
const groupTitleModalGroupId = ref<number | null>(null);
const groupTitleModalUserId = ref<number | null>(null);
const groupTitleModalCurrentTitle = ref("");
const groupTitleModalUsername = ref("");
const groupTitleModalUserAvatar = ref("");
const groupTitleModalUserLevel = ref(0);

// 文件预览
const filePreviewVisible = ref(false);
const filePreviewData = ref<SelectedFile | null>(null);
const filePreviewList = ref<SelectedFile[]>([]);
const filePreviewCurrentIndex = ref(0);

// ============================================================
// 多选功能
// ============================================================
const isAllSelected = computed(() => {
  if (!displayMessages.value.length) return false;
  const validMessages = displayMessages.value.filter(
    (m) => !m.isRecalled && m.id && !isJoinNoticeMessage(m),
  );
  return (
    validMessages.length > 0 && validMessages.every((m) => selectedMessageIds.value.has(m.id!))
  );
});

const toggleMessageSelection = (message: ChatMessage) => {
  if (!message.id) return;
  if (selectedMessageIds.value.has(message.id)) {
    selectedMessageIds.value.delete(message.id);
  } else {
    selectedMessageIds.value.add(message.id);
  }
};

const handleSelectAll = () => {
  if (!displayMessages.value.length) return;

  if (isAllSelected.value) {
    selectedMessageIds.value.clear();
  } else {
    displayMessages.value.forEach((m) => {
      if (m.id && !m.isRecalled && !isJoinNoticeMessage(m)) {
        selectedMessageIds.value.add(m.id);
      }
    });
  }
};

const handleCancelMultiSelect = () => {
  selectedMessageIds.value.clear();
  emit("toggle-multi-select-mode");
};

// 退出多选模式时统一清空勾选，避免下次进入多选还残留上一次的选中项
// （覆盖所有退出路径：点取消、批量转发完成、父组件直接关闭等）
watch(
  () => props.isMultiSelectMode,
  (v) => {
    if (!v) selectedMessageIds.value.clear();
  },
);

const handleBatchDelete = async () => {
  if (selectedMessageIds.value.size === 0) {
    antMessage.warning("请先选择要删除的消息");
    return;
  }
  try {
    await new Promise<void>((resolve, reject) => {
      Modal.confirm({
        title: "删除确认",
        content: "确定删除？删除后无法恢复。",
        okText: "确定",
        cancelText: "取消",
        onOk: () => resolve(),
        onCancel: () => reject("cancel"),
      });
    });

    const messageIds = Array.from(selectedMessageIds.value).filter((id) => id);
    if (messageIds.length === 0) {
      antMessage.warning("没有有效的消息ID");
      return;
    }

    const response = await request.post("/message/batch", {
      messageIds: messageIds.map((id) => Number(id)),
    });

    if (response.data) {
      antMessage.success("删除成功");
      messageIds.forEach((id) => {
        const messageToDelete = props.activeContact?.messages.find((m) => m.id === id);
        if (messageToDelete) {
          emit("messageDeleted", messageToDelete);
        }
      });
    } else {
      throw new Error(response.data?.message || "删除失败");
    }

    selectedMessageIds.value.clear();
    emit("toggle-multi-select-mode");
  } catch (e: any) {
    if (e !== "cancel") {
      const errorMessage = e.response?.data?.message || "删除失败";
      antMessage.error(errorMessage);
    }
  }
};

const hasSelection = computed(() => selectedMessageIds.value.size > 0);

/** 当前勾选到的消息对象（按展示顺序） */
const selectedMessages = computed<ChatMessage[]>(() =>
  displayMessages.value.filter((m) => m.id && selectedMessageIds.value.has(m.id)),
);

/** 批量转发：把已勾选的消息交给父组件的转发选择器 */
const handleForwardSelected = () => {
  const list = selectedMessages.value;
  if (!list.length) {
    antMessage.warning("请先选择要转发的消息");
    return;
  }
  emit("forward-messages", list);
};

/** 收藏 / 合并转发 / 分享：后端暂无对应接口，明确告知而不是弹「开发中」 */
const handleUnsupportedAction = (name: string, tip?: string) => {
  antMessage.info(tip || `${name}需要后端接口支持，暂未开放`);
};

// ============================================================
// 群组相关功能
// ============================================================
const getMessageLevelBadge = (m: ChatMessage): string => {
  if (!props.activeContact?.isGroup) return "";
  const member = props.activeContact.groupMembers?.find(
    (g: any) => String(g.id) === String(m.senderId),
  );
  if (!member) return "";
  // AI 机器人：不显示「LV1 初次见面」这类等级头衔，直接标「机器人」
  if ((member as any).isBot) return "机器人";
  const level = member.chatLevel ?? 1;

  if (member.groupTitle && !member.useDefaultTitle) return `LV${level} ${member.groupTitle}`;
  if (member.role === "owner") return `LV${level} 群主`;
  if (member.role === "admin") return `LV${level} 管理员`;
  return `LV${level} ${getLevelTitle(level)}`;
};

const getLevelBadgeClass = (m: ChatMessage): string => {
  if (!props.activeContact?.isGroup) return "";
  const member = props.activeContact.groupMembers?.find(
    (g: any) => String(g.id) === String(m.senderId),
  );
  if (!member) return "";
  // AI 机器人：用专属紫色徽章，不走等级配色
  if ((member as any).isBot) return "badge-bot";
  const level = member.chatLevel ?? 1;

  let titleType = "default";
  if (member.groupTitle && !member.useDefaultTitle) titleType = "custom";
  else if (member.role === "owner") titleType = "owner";
  else if (member.role === "admin") titleType = "admin";

  return badgeStore.getLevelBadgeClass(level, member.role || "", titleType);
};

const canEditTitle = (m: ChatMessage): boolean => {
  if (!props.activeContact?.isGroup) return false;
  const curr = props.activeContact.groupMembers?.find(
    (g) => String(g.id) === String(props.currentUserId),
  );
  const target = props.activeContact.groupMembers?.find((g) => String(g.id) === String(m.senderId));
  if (!curr || !target) return false;
  // AI 机器人没有等级/头衔，不允许点击编辑
  if ((target as any).isBot) return false;
  if (curr.role === "owner") return true;
  if (curr.role === "admin") {
    return target.role !== "owner" && target.role !== "admin";
  }
  return false;
};

const handleTitleClick = (m: ChatMessage) => {
  if (!canEditTitle(m)) return;
  const activeContact = props.activeContact!;
  const member = activeContact.groupMembers?.find((g) => String(g.id) === String(m.senderId));
  let gid = activeContact.id;
  if (typeof gid === "string" && gid.startsWith("group_")) {
    gid = gid.replace("group_", "");
  }
  groupTitleModalGroupId.value = Number(gid) || null;
  groupTitleModalUserId.value = Number(m.senderId);
  groupTitleModalCurrentTitle.value = member?.groupTitle || "";
  groupTitleModalUsername.value = m.sender?.nickname || m.sender?.username || "";
  groupTitleModalUserAvatar.value = m.sender?.avatar || "";
  groupTitleModalUserLevel.value = member?.chatLevel || 1;
  groupTitleModalVisible.value = true;
};

const handleGroupTitleSuccess = (newTitle?: string) => {
  if (!props.activeContact?.isGroup || !groupTitleModalUserId.value) return;
  const m = props.activeContact.groupMembers?.find(
    (g) => String(g.id) === String(groupTitleModalUserId.value),
  );
  if (m) m.groupTitle = newTitle;
};

// ============================================================
// 消息操作
// ============================================================
const handleReEditRecalledMessage = (m: ChatMessage) => {
  if (!m.recalledContent) return;
  if (m.messageType === "image") {
    emit("re-edit-image", m.recalledContent);
  } else if (m.messageType === "video") {
    emit("re-edit-video", m.recalledContent);
  } else {
    emit("re-edit-message", m.recalledContent);
  }
};

const handleDeleteRecalledMessage = async (m: ChatMessage) => {
  try {
    await new Promise<void>((resolve, reject) => {
      Modal.confirm({
        title: "删除确认",
        content: "确定删除这条撤回消息吗？删除后无法恢复。",
        okText: "确定",
        cancelText: "取消",
        onOk: () => resolve(),
        onCancel: () => reject("cancel"),
      });
    });

    await request.delete(`/message/${m.id}`);

    if (props.activeContact?.messages) {
      props.activeContact.messages = props.activeContact.messages.filter((x) => x.id !== m.id);

      // 删除后重新计算联系人列表摘要：取当前最后一条（可能仍是撤回消息，也可能是普通消息）
      const list = props.activeContact.messages;
      const last = list.length ? list[list.length - 1] : undefined;
      const isGroup = !!props.activeContact.isGroup;
      const lastText = last
        ? formatMessageContent(
            last.messageType || "text",
            last.content,
            isGroup,
            last.sender,
            last.isRecalled || false,
            String(props.currentUserId),
            last.senderId,
          )
        : "";

      updateContactLastMessage(props.contacts, props.activeContact.id, lastText, last?.time || "");
    }

    // 刷新消息区 + 通知父组件刷新联系人列表（forceRefresh 绕过缓存，避免摘要被旧缓存覆盖）
    emit("refresh-messages");
    emit("refresh-contacts", true);
  } catch (e: any) {
    if (e !== "cancel") {
      antMessage.error(e.response?.data?.message || getErrorMessage(e, "删除失败"));
    }
  }
};

// 图片 / 视频加载失败：目前无需额外处理（保留占位，避免模板绑定失效）
const handleImageError = (_e: Event, _m?: ChatMessage) => {};
const handleVideoError = (_e: Event, _m: ChatMessage) => {};

const handleFileClick = (message: ChatMessage) => {
  if (!message.content) return;
  let fileInfo: { url: string; filename: string; size: number; type: string };

  try {
    const contentObj =
      typeof message.content === "string" ? JSON.parse(message.content) : message.content;

    fileInfo = {
      url: contentObj.url || message.content,
      filename: contentObj.filename || getFileName(message),
      size: contentObj.size || message.fileSize || 0,
      type: getFileExtension(contentObj.filename || getFileName(message)),
    };
  } catch (e) {
    fileInfo = {
      url: message.content,
      filename: getFileName(message),
      size: message.fileSize || 0,
      type: getFileExtension(getFileName(message)),
    };
  }

  openFilePreview(fileInfo);
};

const openFilePreview = (fileInfo: {
  url: string;
  filename: string;
  size: number;
  type: string;
}) => {
  const mimeType = getMimeType(fileInfo.type);
  const virtualFile = new File([], fileInfo.filename, {
    type: mimeType,
    lastModified: Date.now(),
  });

  Object.defineProperty(virtualFile, "size", {
    value: fileInfo.size || 0,
    writable: false,
  });

  const selectedFile: SelectedFile = {
    id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    file: virtualFile,
    originalName: fileInfo.filename,
    tempFilename: fileInfo.filename,
    previewUrl: fileInfo.url,
    size: fileInfo.size,
    mimeType: mimeType,
    mediaType: "file",
  };

  filePreviewData.value = selectedFile;
  filePreviewList.value = [selectedFile];
  filePreviewCurrentIndex.value = 0;
  filePreviewVisible.value = true;
};

const handleMessageClick = (e: MouseEvent) => e.stopPropagation();
const handleImageClick = (e: MouseEvent) => e.stopPropagation();
const handleVideoClick = (e: MouseEvent) => e.stopPropagation();

// 右键消息：阻止浏览器默认菜单，向父组件请求显示自定义右键菜单
const handleContextMenu = (event: MouseEvent, message: ChatMessage) => {
  event.preventDefault();
  event.stopPropagation();
  // 打开消息菜单时先关掉头像菜单，避免两个菜单叠在一起
  closeAvatarMenu();
  emit("context-menu-show", event, message);
};

// 多选模式下选中指定消息（供父组件通过 ref 调用）
const selectMessage = (messageId: string | number) => {
  if (!messageId) return;
  selectedMessageIds.value.add(messageId);
};

const getRecallText = (m: ChatMessage) => {
  const custom = getCustomRecallText();
  return m.isMe ? custom.self || "你撤回了一条消息" : custom.others || "对方撤回了一条消息";
};

// 引用回复的预览文本：媒体消息显示类型占位，普通消息取原文
const getReplyQuotePreview = (replyTo: ChatMessage["replyTo"]) => {
  if (!replyTo) return "";
  if (replyTo.messageType === "image") return "[图片]";
  if (replyTo.messageType === "video") return "[视频]";
  if (replyTo.messageType === "file") return "[文件]";
  return replyTo.content || "";
};

const getMessageAvatar = (m: ChatMessage) => m.sender?.avatar || "";

// ============================================================
// 头像右键菜单（仅群聊）：@Ta / 个人资料
// ============================================================
interface AvatarMenuTarget {
  userId: number;
  displayName: string;
  isSelf: boolean;
}

const avatarMenuVisible = ref(false);
const avatarMenuPosition = ref({ x: 0, y: 0 });
const avatarMenuTarget = ref<AvatarMenuTarget | null>(null);

const closeAvatarMenu = () => {
  avatarMenuVisible.value = false;
  avatarMenuTarget.value = null;
};

/** 群聊中右击头像：打开「@Ta / 个人资料」菜单；非群聊不拦截，走浏览器默认菜单 */
const handleAvatarContextMenu = (event: MouseEvent, m: ChatMessage) => {
  // 仅群聊提供头像右键菜单
  if (!props.activeContact?.isGroup) return;

  const userId = Number(m.sender?.id ?? m.senderId);
  if (!userId) return;

  event.preventDefault();
  event.stopPropagation();

  // 打开头像菜单时先关掉消息右键菜单，避免两个菜单叠在一起
  emit("context-menu-close");

  avatarMenuTarget.value = {
    userId,
    // @Ta 优先用群昵称，与消息里展示的发送者名保持一致
    displayName:
      m.sender?.groupNickname || m.sender?.nickname || m.sender?.username || m.senderName || "Ta",
    isSelf: !!m.isMe || String(m.senderId ?? userId) === String(props.currentUserId),
  };
  avatarMenuPosition.value = { x: event.clientX, y: event.clientY };
  avatarMenuVisible.value = true;
};

/** @Ta：把「@昵称 」插入输入框，交给父组件处理 */
const handleAvatarMention = () => {
  const target = avatarMenuTarget.value;
  if (!target) return;
  emit("mention-user", target.displayName);
  closeAvatarMenu();
};

/** 个人资料 / 查看自己 */
const handleAvatarViewProfile = () => {
  const target = avatarMenuTarget.value;
  if (!target) return;

  userProfileModalUserId.value = target.userId;
  userProfileModalPosition.value = target.isSelf ? "left" : "right";
  userProfileModalAnchorX.value = avatarMenuPosition.value.x || 0;
  userProfileModalVisible.value = true;
  closeAvatarMenu();
};

/** 已展开「深度思考」的消息 id（机器人回复默认带思考过程，点击展开/收起） */
const expandedThinkingIds = ref<string[]>([]);

const isThinkingExpanded = (m: any) =>
  expandedThinkingIds.value.includes(String(m?.id));

const toggleThinking = (m: any) => {
  const id = String(m?.id);
  expandedThinkingIds.value = expandedThinkingIds.value.includes(id)
    ? expandedThinkingIds.value.filter((item) => item !== id)
    : [...expandedThinkingIds.value, id];
};

const handleAvatarClick = (m: ChatMessage) => {
  if (!m.sender?.id) return;
  userProfileModalUserId.value = Number(m.sender.id);
  userProfileModalPosition.value = m.isMe ? "left" : "right";
  userProfileModalAnchorX.value = (window.event as MouseEvent).clientX || 0;
  userProfileModalVisible.value = true;
};

const handleAddFriendFromProfile = (id: number) => emit("show-add-friend-modal", id);
const handleSendMessageFromProfile = (payload: { userId: number; userInfo: any }) => {
  userProfileModalVisible.value = false;
  emit("send-message", payload);
};
const handleReportFromProfile = (id: number) => {
  userProfileModalVisible.value = false;
  emit("report", id);
};

const handleFilePreviewClose = () => {
  filePreviewVisible.value = false;
  filePreviewData.value = null;
  filePreviewList.value = [];
  filePreviewCurrentIndex.value = 0;
};

const handleDeleteFileFromPreview = (fileId: string) => {
  const index = filePreviewList.value.findIndex((f) => f.id === fileId);
  if (index > -1) {
    filePreviewList.value.splice(index, 1);
    if (filePreviewCurrentIndex.value >= filePreviewList.value.length) {
      filePreviewCurrentIndex.value = Math.max(0, filePreviewList.value.length - 1);
    }
    if (filePreviewList.value.length === 0) {
      handleFilePreviewClose();
    } else {
      filePreviewData.value = filePreviewList.value[filePreviewCurrentIndex.value];
    }
  }
};

const handleDownloadFileFromPreview = (file: SelectedFile) => {
  if (!file.previewUrl) return;
  const link = document.createElement("a");
  link.href = file.previewUrl;
  link.download = file.tempFilename || file.originalName || file.file.name || "download";
  link.target = "_blank";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  antMessage.success("开始下载");
};

const isOnlyEmoji = (text: string) => {
  return /^(\p{Emoji_Presentation}|\p{Extended_Pictographic})+$/u.test(text?.trim() || "");
};

const shouldShowTimeStampLocal = (m: ChatMessage, i: number) => {
  // 与 v-for 使用同一份「渲染列表」（displayMessages），保证时间戳/分割线判断的索引一致
  return shouldShowTimeStamp(m, i, displayMessages.value);
};

const previewImage = (url: string) => emit("previewImage", url);
const previewVideo = (url: string) => emit("previewVideo", url);
const playVideoOnHover = (e: MouseEvent) => emit("playVideoOnHover", e);
const pauseVideoOnLeave = (e: MouseEvent) => emit("pauseVideoOnLeave", e);

// ============================================================
// 滚动加载
// ============================================================
const scrollToBottom = () => {
  nextTick(() => {
    const c = messagesContainerRef.value;
    if (c) {
      c.scrollTop = c.scrollHeight;
    }
    syncScrollbar();
  });
};

const handleScroll = async (e: Event) => {
  // 用 rAF 节流同步滚动条
  syncScrollbar();

  const t = e.target as HTMLElement;
  if (t.scrollTop < scrollThreshold && hasMoreHistory.value && !loadingMoreHistory.value) {
    await loadMoreHistory();
  }
};

const loadMoreHistory = async () => {
  if (!props.activeContact || !hasMoreHistory.value || loadingMoreHistory.value) return;
  loadingMoreHistory.value = true;
  try {
    const c = messagesContainerRef.value;
    const oh = c?.scrollHeight || 0;
    const ot = c?.scrollTop || 0;
    const res = await getChatHistory(
      props.activeContact.id,
      {
        currentUserId: String(props.currentUserId),
        contacts: props.contacts,
        activeContactId: ref(String(props.activeContact.id)),
      },
      currentPage.value + 1,
      50,
    );
    if (res.pagination) {
      currentPage.value = res.pagination.currentPage;
      hasMoreHistory.value = res.pagination.hasNextPage;
      if (res.messages.length === 0 && currentPage.value === 1) {
        hasMoreHistory.value = false;
      }
    } else {
      hasMoreHistory.value = false;
    }
    await nextTick();
    if (c && res.messages.length) {
      c.scrollTop = ot + (c.scrollHeight - oh);
    }
    syncScrollbar();
  } catch (e: any) {
    console.error("加载历史消息失败:", e);
    const statusCode = e.response?.status;
    if (statusCode !== 404) antMessage.error("加载历史消息失败");
    else hasMoreHistory.value = false;
  } finally {
    loadingMoreHistory.value = false;
  }
};

const resetInfiniteScroll = () => {
  loadingMoreHistory.value = false;
  hasMoreHistory.value = true;
  currentPage.value = 1;
};

// ============================================================
// 系统消息
// ============================================================
const handleOpenSystemMessageDetail = (m: ChatMessage) => {
  systemMessageDetailData.value = m;
  systemMessageDetailVisible.value = true;
};

const handleSystemMessageDetailClose = () => {
  systemMessageDetailData.value = null;
};

// 注：WebSocket 连接状态提示条已移到 MiddleArea（搜索框下方），
// 不再占用聊天界面顶部，避免把消息区往下顶。

const retrySendMessage = (message: ChatMessage) => {
  // 交给父组件真正重新发送（复用 clientMessageId，后端幂等去重，不重复入库）
  emit("retry-send-message", message);
};

const handleRedial = (message: ChatMessage) => {
  if (!message.callType) return;
  emit("redial-call", {
    callType: message.callType,
    contactId: props.activeContact?.id,
  });
};

// ============================================================
// AI 回复逐字输出（打字机）
// ============================================================
/** 正在逐字输出的消息：id → 当前已显示的文本片段 */
const streamingText = ref<Record<string, string>>({});
/** 已处理过的消息 id（避免重复播放） */
const streamedMessageIds = new Set<string>();
/** 每条消息的逐字定时器 */
const streamTimers = new Map<string, ReturnType<typeof setInterval>>();
/** 只有「刚到达」的 AI 消息才逐字播放，历史消息直接整条显示 */
const STREAM_FRESH_MS = 15_000;
/** 逐字总时长（毫秒）与推进次数 */
const STREAM_DURATION_MS = 1100;
const STREAM_STEPS = 44;

const messageKey = (message: ChatMessage): string =>
  message.id === undefined || message.id === null ? "" : String(message.id);

/** 该消息是否正在逐字输出 */
const isStreamingMessage = (message: ChatMessage): boolean => {
  const key = messageKey(message);
  return key !== "" && streamingText.value[key] !== undefined;
};

/** 渲染用文本：逐字中显示已输出的部分，否则显示完整内容 */
const messageRenderContent = (message: ChatMessage): string => {
  const key = messageKey(message);
  const partial = key ? streamingText.value[key] : undefined;
  return partial === undefined ? message.content : partial;
};

/** 视图是否停留在底部（在底部才跟随滚动，避免打断用户翻看历史） */
const isViewAtBottom = (): boolean => {
  const container = messagesContainerRef.value;
  if (!container) return true;
  return container.scrollHeight - container.scrollTop - container.clientHeight < 80;
};

/** 结束一条消息的逐字输出（直接显示完整文本） */
const finishStream = (key: string) => {
  const timer = streamTimers.get(key);
  if (timer) {
    clearInterval(timer);
    streamTimers.delete(key);
  }
  if (key in streamingText.value) {
    const next = { ...streamingText.value };
    delete next[key];
    streamingText.value = next;
  }
};

/** 对一条 AI 消息启动逐字输出 */
const startStream = (message: ChatMessage) => {
  const key = messageKey(message);
  const full = String(message.content ?? "");
  if (!key || !full) return;

  streamingText.value = { ...streamingText.value, [key]: "" };
  const step = Math.max(1, Math.ceil(full.length / STREAM_STEPS));
  const intervalMs = Math.max(16, Math.round(STREAM_DURATION_MS / STREAM_STEPS));

  const timer = setInterval(() => {
    const current = streamingText.value[key];
    if (current === undefined) {
      finishStream(key);
      return;
    }
    const nextText = full.slice(0, current.length + step);
    streamingText.value = { ...streamingText.value, [key]: nextText };
    if (isViewAtBottom()) scrollToBottom();
    if (nextText.length >= full.length) finishStream(key);
  }, intervalMs);

  streamTimers.set(key, timer);
};

/** 扫描消息列表：对刚到达的 AI 回复启动逐字输出 */
const scanStreamCandidates = () => {
  for (const message of displayMessages.value) {
    const key = messageKey(message);
    if (!key || streamedMessageIds.has(key)) continue;
    if (!message.isBotMessage) continue;
    // 无论是否播放，都只处理一次
    streamedMessageIds.add(key);
    if (message.isMe) continue;
    if (!String(message.content ?? "").length) continue;
    const created = getMsgSortTime(message);
    if (created && Date.now() - created > STREAM_FRESH_MS) continue; // 历史消息不播放
    startStream(message);
  }
};

// 会话切换或消息数量变化时扫描（只依赖轻量标识，避免 deep watch 的性能损耗）
watch(
  () => {
    const msgs = displayMessages.value;
    return [props.activeContact?.id ?? "", msgs.length].join("|");
  },
  () => scanStreamCandidates(),
  { immediate: true, flush: "post" },
);

/** 停止所有逐字定时器（组件卸载时清理） */
const stopAllStreams = () => {
  for (const timer of streamTimers.values()) clearInterval(timer);
  streamTimers.clear();
  streamingText.value = {};
};

// ============================================================
// 生命周期
// ============================================================
// 消息变化时重新计算滚动条。
// 只监听「会话 id + 消息数量 + 最后一条消息 id」，避免 deep 遍历整个消息数组
// （长会话下 deep watch 会带来明显性能损耗）。
watch(
  () => {
    const msgs = props.activeContact?.messages;
    return [props.activeContact?.id, msgs?.length ?? 0, msgs?.[msgs.length - 1]?.id ?? ""].join(
      "|",
    );
  },
  () => {
    nextTick(() => syncScrollbar());
  },
  { immediate: true },
);

// 监听窗口尺寸，重新计算滚动条
const onWindowResize = () => syncScrollbar();

onMounted(() => {
  scrollToBottom();
  // 注意：滚动监听由模板的 @scroll="handleScroll" 负责，
  // 这里不再重复 addEventListener("scroll")，避免同一次滚动触发两次 handleScroll。

  window.addEventListener("resize", onWindowResize);
  nextTick(() => syncScrollbar());
});

onUnmounted(() => {
  window.removeEventListener("resize", onWindowResize);
  stopDragThumb();
  if (syncRafId !== null) cancelAnimationFrame(syncRafId);
  if (rafId !== null) cancelAnimationFrame(rafId);
  stopAllStreams();
});

defineExpose({ messagesContainerRef, scrollToBottom, resetInfiniteScroll, selectMessage });
</script>

<style scoped>
@import "../assets/scss/level-badge.scss";

.chat-session-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* AI 回复逐字输出时的闪烁光标 */
.bot-typing-cursor {
  display: inline-block;
  width: 2px;
  height: 1em;
  margin-left: 2px;
  vertical-align: -0.15em;
  background-color: currentColor;
  animation: botCaretBlink 0.9s steps(1, end) infinite;
}

@keyframes botCaretBlink {
  0%,
  50% {
    opacity: 1;
  }
  50.01%,
  100% {
    opacity: 0;
  }
}

/* 消息滚动外层：承载自定义滚动条 hover 区 */
.messages-scroll-host {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* ============================================================
   ✅ 滚动条：原生滚动条完全隐藏，改用自定义滑块
   ============================================================ */
.messages-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 16px;
  height: 100%;
  overflow-y: auto;
  scroll-behavior: smooth;

  /* 隐藏原生滚动条 */
  scrollbar-width: none; /* Firefox */
  -ms-overflow-style: none; /* IE/Edge */
}

.messages-container::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
}

/* 自定义滚动条 hover 区（贴右边缘 12px 宽的透明条） */
.scroll-hover-zone {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 12px;
  z-index: 20;
  pointer-events: auto;
  transition: none;
}

/* 自定义滑块：默认隐藏，hover 区 hover 时才显示
   ✅ 颜色很淡，鼠标经过时出现，不打扰视线 */
.scroll-thumb {
  position: absolute;
  top: 0;
  right: 2px;
  width: 6px;
  border-radius: 3px;
  /* ✅ 淡色：极浅灰 */
  background: rgba(0, 0, 0, 0.12);
  cursor: pointer;
  visibility: hidden;
  opacity: 0;
  /* 只过渡 opacity，不动 visibility，避免抖动 */
  transition: opacity 0.1s linear;
  will-change: transform, opacity;
  transform: translate3d(0, 0, 0);
}

.scroll-thumb.is-visible {
  visibility: visible;
  opacity: 1;
}

/* 鼠标按住/悬停滑块时稍微深一点点，仍然很淡 */
.scroll-thumb:hover {
  background: rgba(0, 0, 0, 0.2);
}

.join-group-notice-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 12px;
  animation: fadeInUp 0.3s ease-out;
}

.join-group-text {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.join-group-time {
  font-size: 11px;
  color: var(--tag-color, #8e8e93);
  padding: 3px 12px;
  border-radius: 12px;
  background: var(--tag-bg, rgba(0, 0, 0, 0.05));
  margin-bottom: 4px;
  user-select: none;
}

.join-tag {
  font-size: 12px;
  padding: 4px 12px;
  background: var(--tag-bg, rgba(0, 122, 255, 0.1));
  color: var(--tag-color, #007aff);
  border-radius: 16px;
}

/* 动态背景（个性装扮）下：入群通知时间/标签转白字 + 阴影，保证在壁纸上可读 */
.chat-session-section.has-dynamic-bg .join-group-time,
.chat-session-section.has-dynamic-bg .join-tag {
  color: var(--dt-text);
  text-shadow: var(--dt-text-shadow);
}
.chat-session-section.has-dynamic-bg .join-tag,
.chat-session-section.has-dynamic-bg .join-group-time {
  background: rgba(0, 0, 0, 0.28);
}

.recalled-message-hint-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 12px;
  margin: 0 auto;
}

.recalled-text {
  font-size: 12px;
  color: var(--text-secondary, #8e8e93);
}

.recalled-content-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.re-edit-link {
  font-size: 12px;
  color: var(--re-edit-accent, var(--link-color, #007aff));
  cursor: pointer;
  /* 波浪线 + 吸取主题色 */
  text-decoration: underline wavy;
  text-decoration-color: var(--re-edit-accent, var(--link-color, #007aff));
  text-underline-offset: 3px;
  text-decoration-thickness: 1px;
  transition: opacity 0.2s ease;
  vertical-align: baseline;
}

.re-edit-link:hover {
  opacity: 0.8;
}

.delete-recalled-btn {
  font-size: 14px;
  color: var(--text-secondary, #8e8e93);
  cursor: pointer;
  padding: 0 4px;
  transition: color 0.2s ease;
  vertical-align: baseline;
  line-height: 1;
}

.delete-recalled-btn:hover {
  color: var(--danger-color, #ff3b30);
}

/* 动态背景（个性装扮）下：撤回提示文字转白字 + 阴影，保证在壁纸上清晰可读 */
.chat-session-section.has-dynamic-bg .recalled-text {
  color: var(--dt-text);
  text-shadow: var(--dt-text-shadow);
}
.chat-session-section.has-dynamic-bg .re-edit-link {
  color: var(--re-edit-accent, #fff);
  text-shadow: var(--dt-text-shadow);
  opacity: 0.92;
}
.chat-session-section.has-dynamic-bg .re-edit-link:hover {
  opacity: 1;
}
.chat-session-section.has-dynamic-bg .delete-recalled-btn {
  color: var(--dt-text);
  text-shadow: var(--dt-text-shadow);
}
.chat-session-section.has-dynamic-bg .delete-recalled-btn:hover {
  color: #ff7b72;
}

.message-wrapper {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: 12px;
  position: relative;
  animation: fadeInUp 0.3s ease-out;
}

.message-wrapper.recalled-message-wrapper {
  align-items: center;
}

.message-wrapper.selected-message {
  background: var(--selected-bg, rgba(0, 122, 255, 0.05));
  border-radius: 8px;
  transition: background 0.2s ease;
}

.message-checkbox {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  z-index: 10;
  padding: 0 4px;
  cursor: pointer;
}

.message-wrapper.my-message-wrapper .message-checkbox {
  left: auto;
  right: 0;
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
  transition: all 0.2s ease;
}

.checkbox-checked {
  background: var(--text-primary, #1a1a2e);
  border-color: var(--text-primary, #1a1a2e);
}

.checkmark-icon {
  color: #ffffff;
  font-size: 10px;
}

.message-timestamp {
  margin: 6px auto;
  padding: 3px 12px;
  font-size: 11px;
  line-height: 1.5;
  color: var(--tag-color, #6b7280);
  background: var(--tag-bg, rgba(0, 0, 0, 0.06));
  border-radius: 12px;
  width: fit-content;
  max-width: 92%;
  white-space: nowrap;
  user-select: none;
}

/* ===== 新消息分割线 ===== */
.new-message-divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 16px 0;
  padding: 0 16px;
  position: relative;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent 0%,
    var(--divider-line-color, #6366f1) 20%,
    var(--divider-line-color, #6366f1) 80%,
    transparent 100%
  );
}

.divider-text {
  font-size: 11px;
  font-weight: 500;
  color: var(--divider-text-color, #6366f1);
  white-space: nowrap;
  letter-spacing: 0.5px;
  padding: 2px 8px;
  border-radius: 10px;
}

.message-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  width: 100%;
}

.message-wrapper.has-checkbox .message-item {
  padding-left: 28px;
}

.message-wrapper.has-checkbox.my-message-wrapper .message-item {
  padding-left: 0;
  padding-right: 28px;
}

.message-item.my-message {
  flex-direction: row-reverse;
}

.message-avatar {
  flex-shrink: 0;
  margin-top: 2px;
  transition: transform 0.2s ease;
}

/* ===== 关键修复：消息内容区 ===== */
.message-content {
  flex: 0 1 auto !important;
  min-width: 0 !important;
  max-width: 75% !important;
  display: flex !important;
  flex-direction: column !important;
}

.message-item.my-message .message-content {
  align-items: flex-end !important;
  max-width: 75% !important;
}

.message-sender-name {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 12px;
  line-height: 1.4;
  max-width: 100%;
}

.level-badge-combined {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 500;
  line-height: 1.3;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
  vertical-align: middle;
  flex-shrink: 0;
}

.sender-nickname {
  display: inline-flex;
  align-items: center;
  font-weight: 500;
  line-height: 1.3;
  vertical-align: middle;
  color: var(--text-primary);
  word-break: break-word;
}

/* ===== 关键修复：消息气泡（无阴影） ===== */
.message-bubble {
  position: relative !important;
  display: inline-block !important;
  padding: 4px 8px !important;
  border-radius: 10px !important;
  width: auto !important;
  min-width: 20px !important;
  max-width: 100% !important;
  word-wrap: break-word !important;
  word-break: break-word !important;
  overflow-wrap: break-word !important;
  box-sizing: border-box !important;
  background-clip: padding-box !important;
  box-shadow: none !important;
}

.message-item.my-message .message-bubble {
  margin-left: auto !important;
}

.message-item:not(.my-message) .message-bubble {
  margin-right: auto !important;
}

/* ✅ 气泡：无阴影，仅靠底色 + 描边区分 */
.message-bubble.my-bubble,
.message-bubble.other-bubble {
  background: var(--message-bubble-bg, #ffffff);
  color: var(--message-bubble-text, #0a0a0a);
  border: var(--message-bubble-border, rgba(0, 0, 0, 0.06));
  box-shadow: none;
}

/* ===== 图片/视频/文件消息 ===== */
.message-bubble.image-bubble,
.message-bubble.video-bubble,
.message-bubble.file-bubble {
  padding: 0 !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  max-width: 100% !important;
  width: auto !important;
  display: inline-block !important;
}

.message-image-container {
  display: inline-block !important;
  max-width: 280px !important;
  max-height: 280px !important;
  border-radius: 8px !important;
  overflow: hidden !important;
}

.message-image {
  max-width: 280px !important;
  max-height: 280px !important;
  width: auto !important;
  height: auto !important;
  display: block !important;
}

.message-video-container {
  display: inline-block !important;
  max-width: 280px !important;
  max-height: 280px !important;
  border-radius: 8px !important;
  overflow: hidden !important;
}

.message-video {
  max-width: 280px !important;
  max-height: 280px !important;
  width: auto !important;
  height: auto !important;
  display: block !important;
}

.message-file-container {
  display: flex !important;
  align-items: center !important;
  gap: 12px !important;
  padding: 12px !important;
  background: var(--bg-primary, #ffffff) !important;
  border: 1px solid var(--border-light, #e5e7eb) !important;
  border-radius: 10px !important;
  min-width: 160px !important;
  max-width: 280px !important;
  cursor: pointer !important;
  transition: all 0.2s ease !important;
}

.file-icon-wrapper {
  width: 48px;
  height: 48px;
  background: var(--bg-tertiary, #f5f5f5);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.file-icon {
  font-size: 28px;
  color: var(--text-primary, #1a1a2e);
}

.file-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}

.file-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary, #333333);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.file-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
  color: var(--text-secondary, #999999);
}

.file-size {
  padding: 1px 6px;
  background: var(--tag-bg, #e8e8e8);
  border-radius: 3px;
  color: var(--tag-color, #666666);
}

.file-type {
  color: var(--tag-color, #666666);
}

.media-load-error {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 16px;
  background: var(--bg-primary, rgba(255, 255, 255, 0.9));
  border-radius: 8px;
}

.error-text {
  font-size: 11px;
  color: var(--text-secondary, #666666);
}

.video-play-icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 36px;
  height: 36px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ffffff;
  font-size: 16px;
  pointer-events: none;
  transition: transform 0.2s ease;
}

.message-video-container:hover .video-play-icon {
  transform: translate(-50%, -50%) scale(1.1);
}

.text-message-content {
  word-wrap: break-word !important;
  white-space: pre-wrap !important;
  line-height: 1.5 !important;
  font-size: 13.5px !important;
  /* 加粗一档，让笔画更实、不再发灰发虚 */
  font-weight: 500 !important;
  color: inherit !important;
  max-width: 100% !important;
  display: inline !important;
}

/* 个性装扮（动态背景）下气泡文字色由气泡底色的亮度自动决定（见 getBubbleStyle），
   这里不再强制转白，避免浅色气泡配白字看不清 */

/* ===== 个性装扮（动态壁纸）气泡造型：更宽松的圆角与内边距 =====
   底色/描边由 getBubbleStyle 内联决定，这里只调形状（内联改不动 !important 的 padding/圆角）。
   注意：左右气泡必须**保持一致**，不再给「自己（右侧）/对方（左侧）」设置不同方向的切角 */
.chat-session-section.has-dynamic-bg .message-bubble {
  padding: 8px 12px !important;
  border-radius: 14px !important;
  box-shadow: none !important;
}

/* 发送者昵称 / 时间戳也加阴影 */
.chat-session-section.has-dynamic-bg .message-sender-name .sender-nickname,
.chat-session-section.has-dynamic-bg .message-timestamp {
  color: var(--dt-text);
  text-shadow: var(--dt-text-shadow);
}
.chat-session-section.has-dynamic-bg .message-timestamp {
  background: rgba(0, 0, 0, 0.28);
}

.emoji-only-message {
  /* 需要 !important，否则会被 .text-message-content 的基础字号覆盖 */
  font-size: 22px !important;
  line-height: 1.25 !important;
}

/* ===== AI 深度思考（机器人回复） ===== */
.deep-thinking-block {
  width: 100%;
  max-width: 100%;
  margin-bottom: 6px;
  padding: 4px 6px;
  border-radius: 8px;
  /* 放在气泡内：用中性半透明底 + 继承气泡文字色，深浅气泡都可读 */
  background: rgba(127, 127, 127, 0.12);
  font-size: 12px;
  color: inherit;
  opacity: 0.9;
}

.deep-thinking-header {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  user-select: none;
}

.deep-thinking-title {
  font-size: 12px;
  opacity: 0.85;
}

.deep-thinking-arrow {
  font-size: 12px;
  transition: transform 0.2s ease;
}

.deep-thinking-arrow.arrow-rotated {
  transform: rotate(180deg);
}

.deep-thinking-body {
  margin-top: 4px;
  padding-top: 4px;
  border-top: 1px dashed rgba(127, 127, 127, 0.35);
  white-space: pre-wrap;
  line-height: 1.6;
}

/* ===== 引用回复头部 ===== */
.reply-quote-header {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 4px 8px;
  margin-bottom: 4px;
  border-left: 3px solid rgba(128, 128, 128, 0.35);
  background: rgba(128, 128, 128, 0.12);
  border-radius: 4px;
  font-size: 12px;
  max-width: 100%;
}

.reply-quote-sender {
  font-weight: 600;
  flex-shrink: 0;
  color: inherit;
}

.reply-quote-content {
  color: inherit;
  opacity: 0.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.system-message-content {
  display: inline !important;
  word-wrap: break-word !important;
  white-space: pre-wrap !important;
}

.call-message-content {
  display: flex !important;
  flex-direction: column !important;
  gap: 2px !important;
  min-width: 120px !important;
}

.call-info-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.call-type-icon {
  font-size: 16px;
  color: var(--text-primary, #1a1a2e);
  flex-shrink: 0;
}

.call-status-text {
  font-size: 13px;
  color: var(--text-primary, #333333);
  line-height: 1.4;
}

.call-duration {
  font-size: 11px;
  color: var(--text-secondary, #8e8e93);
  padding-left: 22px;
}

.call-redial-inline {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  color: var(--text-primary, #1a1a2e);
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s ease;
}

.call-redial-inline:hover {
  opacity: 0.7;
}

.redial-icon-inline {
  font-size: 13px;
  color: var(--text-primary, #1a1a2e);
}

.message-status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-secondary, #999999);
}

.sending-text {
  color: var(--text-secondary, #999999);
}

.failed-text {
  color: var(--danger-color, #f44336);
}

.retry-button {
  padding: 2px 6px;
  font-size: 11px;
  color: var(--link-color, #6366f1);
}

.retry-button:hover {
  background: transparent;
  color: var(--link-color, #6366f1);
}

.multi-select-bottom-bar {
  position: sticky;
  bottom: 0;
  background: var(--bg-primary, rgba(255, 255, 255, 0.95));
  backdrop-filter: blur(10px);
  border-top: 1px solid var(--border-light, rgba(0, 0, 0, 0.1));
  padding: 10px 16px;
  z-index: 100;
  animation: slideUp 0.3s ease-out;
}

.bottom-bar-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.selection-info {
  font-size: 13px;
  color: var(--text-primary, #666666);
}

.bottom-actions {
  display: flex;
  gap: 12px;
}

.action-item {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-primary, #666666);
  font-size: 16px;
  transition: all 0.2s ease;
}

.action-item:hover {
  background: var(--bg-tertiary, rgba(0, 0, 0, 0.05));
  color: var(--text-primary, #1a1a2e);
  transform: scale(1.05);
}

.action-item.danger:hover {
  background: rgba(255, 59, 48, 0.1);
  color: var(--danger-color, #ff3b30);
}

/* 未勾选时不可用 */
.action-item.is-disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.action-item.is-disabled:hover {
  background: transparent;
  transform: none;
}

/* 后端暂无接口的功能：置灰但仍可点击以给出说明 */
.action-item.is-unsupported {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-item.is-unsupported:hover {
  background: transparent;
  transform: none;
}

mark.highlight {
  background: var(--highlight-bg, #fff3e0);
  color: var(--highlight-color, #ff9800);
  padding: 0 2px;
  border-radius: 2px;
}

/* ===== 消息加载中提示（sticky 顶部，无背景） ===== */
.loading-more-history {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  color: var(--text-secondary, #8e8e93);
  font-size: 12px;
  /* 顶部吸附：滚动到顶部加载时，指示器始终可见 */
  position: sticky;
  top: 0;
  z-index: 5;
  /* 无背景，仅文字 + 图标 */
  background: transparent;
  border-radius: 0 0 10px 10px;
}

/* 动态背景（个性装扮）下：加载提示转白字 */
.chat-session-section.has-dynamic-bg .loading-more-history {
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
  text-shadow: var(--dt-text-shadow);
}

.select-all-btn {
  color: var(--link-color, #6366f1);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.select-all-btn:hover {
  background: var(--primary-light, rgba(0, 122, 255, 0.1));
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideUp {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.sending-message .message-bubble {
  opacity: 0.92;
}

.failed-message .message-bubble {
  opacity: 0.7;
  border: 1px dashed var(--danger-color, #f44336);
}

/* ===== 响应式调整 ===== */
@media (max-width: 768px) {
  .message-content,
  .message-item.my-message .message-content {
    max-width: 85% !important;
  }

  .message-image-container,
  .message-video-container {
    max-width: 220px !important;
    max-height: 220px !important;
  }

  .message-image,
  .message-video {
    max-width: 220px !important;
    max-height: 220px !important;
  }

  .message-file-container {
    max-width: 220px !important;
    min-width: 120px !important;
  }

  .messages-container {
    padding: 8px 10px;
  }
}

@media (max-width: 480px) {
  .message-content,
  .message-item.my-message .message-content {
    max-width: 90% !important;
  }

  .message-image-container,
  .message-video-container {
    max-width: 180px !important;
    max-height: 180px !important;
  }

  .message-image,
  .message-video {
    max-width: 180px !important;
    max-height: 180px !important;
  }

  .message-file-container {
    max-width: 180px !important;
    min-width: 100px !important;
    padding: 8px 10px !important;
  }

  .file-icon-wrapper {
    width: 36px;
    height: 36px;
  }

  .file-icon {
    font-size: 20px;
  }
}
</style>
