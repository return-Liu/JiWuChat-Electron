<template>
  <div
    class="message-input-area"
    :class="{ 'has-dynamic-bg': siderColorStore.hasDynamicBackground }"
    :style="{
      ...inputAreaStyle,
      '--theme-primary-rgb': hexToRgb(currentColorPalette.color),
      '--theme-light': currentColorPalette.light,
    }"
  >
    <!-- 只读模式或全员禁言下的提示信息 -->
    <div v-if="readonly || shouldShowMuteAllHint" class="readonly-hint">
      <div class="hint-content">
        <span class="hint-text">{{ readonly ? noContentTip : muteAllHintText }}</span>
      </div>
    </div>

    <!-- 被拉黑时的提示信息（区分双向） -->
    <div v-else-if="theyBlockedMe" class="readonly-hint blocked-hint">
      <div class="hint-content">
        <span class="hint-text">对方已将你拉黑，无法发送消息</span>
      </div>
    </div>
    <div v-else-if="iBlockedThem" class="readonly-hint blocked-hint">
      <div class="hint-content">
        <span class="hint-text">你已拉黑对方，无法发送消息，请先取消拉黑</span>
      </div>
    </div>

    <!-- 非只读模式下的正常输入区域 -->
    <template v-else>
      <!-- 语音录制模式 - 隐藏工具栏 -->
      <VoiceRecordingArea
        v-if="isVoiceMode"
        :is-recording="isVoiceRecording"
        :duration="voiceRecordingDuration"
        @exit="handleExitVoiceMode"
      />

      <!-- 文本输入模式 - 显示工具栏 -->
      <template v-else>
        <div class="input-tools">
          <!-- 左侧工具按钮 -->
          <InputToolButtons
            :disabled="readonly || shouldShowMuteAllHint || isBlockedComputed"
            :hide-voice="isBotContact"
            :hide-media-tools="isBotContact"
            @click="handleToggleEmojiPicker"
            @select-media="handleSelectMedia"
            @voice-message="handleVoiceMessage"
            @select-file="handleSelectFile"
            @screen-capture="handleScreenCapture"
          />
        </div>

        <!-- 文本输入区域 -->
        <div ref="inputWrapperRef" class="message-input-wrapper">
          <!-- 引用回复预览条 -->
          <div v-if="replyTarget" class="reply-preview-bar">
            <div class="reply-preview-content">
              <span class="reply-preview-label">回复 {{ replySenderName }}：</span>
              <span class="reply-preview-text">{{ replyPreviewText }}</span>
            </div>
            <button
              class="reply-preview-close"
              type="button"
              @click="emit('cancel-reply')"
            >
              ✕
            </button>
          </div>

          <!-- 图片/截图预览列表 -->
          <ImagePreviewList :images="selectedImages" @preview="handlePreviewTempImage" />

          <!-- 视频预览列表 -->
          <VideoPreviewList
            :videos="selectedVideos"
            @preview="handlePreviewTempVideo"
            @play-video-on-hover="handlePlayVideoOnHover"
            @pause-video-on-leave="handlePauseVideoOnLeave"
          />

          <!-- 文件预览列表 -->
          <FilePreviewList :files="selectedFiles" @preview="handlePreviewFile" />

          <div class="message-input-container">
            <div
              ref="messageTextareaRef"
              class="message-input-content"
              :contenteditable="!(readonly || shouldShowMuteAllHint || isBlockedComputed)"
              @keydown="handleKeyDown"
              @keyup="handleInputKeyUp"
              @input="handleInput"
              @focus="handleFocus"
              @blur="handleInputBlur"
              @mouseup="handleCaretMoved"
              @paste="handlePaste"
            ></div>
          </div>

          <!-- @ 提及：群成员选择面板 -->
          <div
            v-if="showMentionPanel"
            class="mention-panel"
            :class="{ 'is-dark': isDarkMode }"
            :style="mentionPanelStyle"
            @mousedown.prevent
          >
            <div class="mention-panel-title">选择要提醒的成员</div>
            <div class="mention-list">
              <div v-if="mentionCandidates.length === 0" class="mention-empty">
                {{ mentionLoading ? "成员加载中…" : "没有匹配的成员" }}
              </div>
              <div
                v-for="(member, index) in mentionCandidates"
                :key="`${member.id}-${index}`"
                class="mention-item"
                :class="{ active: index === mentionActiveIndex }"
                @mouseenter="mentionActiveIndex = index"
                @click.stop="insertMention(member)"
              >
                <a-avatar :size="24" :src="member.avatar" class="mention-avatar">
                  <template #fallback>{{ memberDisplayName(member).charAt(0) }}</template>
                </a-avatar>
                <span class="mention-name">{{ memberDisplayName(member) }}</span>
                <span
                  v-if="memberRoleLabel(member)"
                  class="mention-role"
                  :class="`tone-${resolveMentionRole(member)}`"
                  >{{ memberRoleLabel(member) }}</span
                >
                <span v-if="isBotMember(member)" class="mention-role tone-bot">机器人</span>
                <span v-if="isSelfMember(member)" class="mention-role tone-self">我</span>
              </div>
            </div>
          </div>

          <!-- 发送提示 -->
          <div
            class="send-hint"
            @click="
              !isSendButtonEnabled || readonly || shouldShowMuteAllHint || isBlockedComputed
                ? null
                : handleSendMessage()
            "
            :style="{
              opacity:
                !isSendButtonEnabled || readonly || shouldShowMuteAllHint || isBlockedComputed
                  ? 0.5
                  : 1,
              cursor:
                !isSendButtonEnabled || readonly || shouldShowMuteAllHint || isBlockedComputed
                  ? 'not-allowed'
                  : 'pointer',
            }"
          >
            <span class="send-hint-text">按 Enter</span>
            <span class="send-hint-divider">|</span>
            <span class="send-hint-text">Shift + Enter</span>
          </div>
        </div>

        <!-- 表情包选择器 -->
        <EmojiPicker
          :visible="showEmojiPicker"
          @select="handleInsertEmoji"
          @close="showEmojiPicker = false"
        />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, type Ref } from "vue";
import { useUiSettings } from "../stores/uiSettings";
import { useSiderColor } from "../stores/siderColor";
import type { Contact, SelectedImage, SelectedVideo, ChatMessage } from "../types/chatTypes";
import { message } from "ant-design-vue";
import { AudioRecorder, getAudioDuration } from "../untils/audioHandler";

const siderColorStore = useSiderColor();

let typingTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
let lastTypingStatus = false;

// 语音模式状态
const isVoiceMode = ref(false);
const isVoiceRecording = ref(false);
const voiceRecordingDuration = ref(0);

interface ColorPalette {
  name: string;
  color: string;
  light: string;
  active: string;
}

interface SelectedFileItem {
  id: string;
  file: File;
  name?: string;
  size?: number;
  type?: string;
}

interface Props {
  readonly?: boolean;
  isBlocked?: boolean;
  iBlockedThem?: boolean;
  theyBlockedMe?: boolean;
  noContentTip?: string;
  activeContact: Contact | null;
  replyTarget?: ChatMessage | null;
  currentColorPalette: ColorPalette;
  selectedImages: SelectedImage[];
  selectedVideos: SelectedVideo[];
  selectedFiles?: SelectedFileItem[];
  showEmojiPicker: boolean;
  isSendButtonDisabled: boolean;
  newMessage: string;
  contacts?: Contact[];
  currentUserId?: string;
  rightChatAreaRef?: any;
  scrollToBottom?: () => void;
  messagesContainerRef?: HTMLElement | null;
  lastTextSendTime?: number | null;
  lastImageSendTime?: number | null;
  lastVideoSendTime?: number | null;
  lastFileSendTime?: number | null;
  getOptions?: any;
}

const props = withDefaults(defineProps<Props>(), {
  readonly: false,
  isBlocked: false,
  iBlockedThem: false,
  theyBlockedMe: false,
  noContentTip: "爱发消息的人 运气不会差...",
  selectedFiles: () => [],
  currentUserId: "",
  contacts: () => [],
  replyTarget: null,
});

const emit = defineEmits<{
  (
    e: "send-message",
    payload?: {
      text?: string;
      images?: SelectedImage[];
      videos?: SelectedVideo[];
      files?: SelectedFileItem[];
      hasText: boolean;
      hasMedia: boolean;
      hasFiles: boolean;
    },
  ): void;
  (e: "toggle-emoji-picker", event?: Event): void;
  (e: "insert-emoji", emoji: string): void;
  (e: "select-media"): void;
  (e: "select-file", files: File[]): void;
  (e: "remove-image", id: string): void;
  (e: "remove-video", id: string): void;
  (e: "remove-file", id: string): void;
  (e: "preview-temp-image", image: SelectedImage, index: number): void;
  (e: "preview-temp-video", video: SelectedVideo, index: number): void;
  (e: "preview-file", file: SelectedFileItem): void;
  (e: "play-video-on-hover", event: MouseEvent): void;
  (e: "pause-video-on-leave", event: MouseEvent): void;
  (e: "update:new-message", value: string): void;
  (e: "add-screenshot", screenshot: SelectedImage): void;
  (e: "update:show-emoji-picker", value: boolean): void;
  (e: "cancel-reply"): void;
}>();

/** 机器人（AI 助手）会话：输入框只保留输入相关工具（隐藏语音等） */
const isBotContact = computed(() => props.activeContact?.isBot === true);

// 添加响应式变量用于控制表情包选择器的显示
const showEmojiPicker = ref(props.showEmojiPicker);

// 添加响应式变量来跟踪输入框中的文本内容
const currentInputText = ref("");

// 监听外部传入的showEmojiPicker变化
watch(
  () => props.showEmojiPicker,
  (newValue) => {
    showEmojiPicker.value = newValue;
  },
);

// 监听内部showEmojiPicker变化并同步到父组件
watch(showEmojiPicker, (newValue) => {
  emit("update:show-emoji-picker", newValue);
});

const messageTextareaRef = ref<HTMLElement | null>(null);

watch(
  () => props.activeContact,
  async (newVal) => {
    closeMentionPanel();
    if (newVal && messageTextareaRef.value) {
      await nextTick();
      messageTextareaRef.value.focus();
    }
  },
  { immediate: false },
);

// ==================== 键盘事件处理（核心修复） ====================

/**
 * 统一的键盘事件处理
 * 修复回车发送消息的问题
 */
const handleKeyDown = (event: KeyboardEvent) => {
  // 如果处于只读或禁言状态，阻止所有键盘操作
  if (props.readonly || shouldShowMuteAllHint.value || isBlockedComputed.value) {
    event.preventDefault();
    return;
  }

  // @ 提及面板打开时优先消费按键（输入法组合中不拦截）
  if (showMentionPanel.value && !event.isComposing) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveMentionActive(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveMentionActive(-1);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      closeMentionPanel();
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      const target = mentionCandidates.value[mentionActiveIndex.value];
      if (target) {
        event.preventDefault();
        insertMention(target);
        return;
      }
    }
  }

  // 处理回车键
  if (event.key === "Enter") {
    // Shift + Enter 换行
    if (event.shiftKey) {
      // 允许换行，不阻止默认行为
      return;
    }

    // 单独按 Enter 发送消息
    event.preventDefault();

    // 获取当前文本内容
    const text = extractPureTextContent();
    const hasText = text.trim().length > 0;
    const hasMedia = props.selectedImages.length > 0 || props.selectedVideos.length > 0;
    const hasFiles = props.selectedFiles && props.selectedFiles.length > 0;

    // 如果有内容则发送
    if (hasText || hasMedia || hasFiles) {
      handleSendMessage();
    }
    return;
  }

  // 处理 Backspace 删除（删除附件）
  if (event.key === "Backspace") {
    const text = extractPureTextContent();
    const selection = window.getSelection();
    const hasSelection = selection && selection.toString().length > 0;

    // 如果没有文本内容且没有选中内容，删除附件
    if (!hasSelection && text.trim() === "") {
      if (props.selectedFiles && props.selectedFiles.length > 0) {
        event.preventDefault();
        const lastFile = props.selectedFiles[props.selectedFiles.length - 1];
        emit("remove-file", lastFile.id);
        return;
      }
      if (props.selectedVideos.length > 0) {
        event.preventDefault();
        const lastVideo = props.selectedVideos[props.selectedVideos.length - 1];
        emit("remove-video", lastVideo.id);
        return;
      }
      if (props.selectedImages.length > 0) {
        event.preventDefault();
        const lastImage = props.selectedImages[props.selectedImages.length - 1];
        emit("remove-image", lastImage.id);
        return;
      }
    }
  }
};

// ==================== 其他事件处理 ====================

const handleFocus = () => {
  // 聚焦时不需要额外操作
};

const handlePaste = (event: ClipboardEvent) => {
  // 处理粘贴图片
  const items = event.clipboardData?.items;
  if (!items) return;

  for (const item of Array.from(items)) {
    if (item.type.startsWith("image/")) {
      event.preventDefault();
      const file = item.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const previewUrl = e.target?.result as string;
          const image: SelectedImage = {
            id: `paste_${Date.now()}`,
            previewUrl,
            file,
            mediaType: "image",
          };
          // 通过 select-media 事件添加图片
          emit("select-media");
        };
        reader.readAsDataURL(file);
      }
      break;
    }
  }
};

// 移除 inputAreaStyle 中的背景色
const inputAreaStyle = computed(() => {
  return {
    // 输入框背景透明，透出底层视频/图片
    background: "transparent",
    borderTop: `1px solid ${siderColorStore.panelDividerColor}`,
  };
});

// 统一的拉黑判断
const isBlockedComputed = computed(() => {
  return props.iBlockedThem || props.theyBlockedMe || props.isBlocked;
});

const shouldShowMuteAllHint = computed(() => {
  if (!props.activeContact?.isGroup || !props.activeContact?.muteAll) {
    return false;
  }
  const userRole = props.activeContact.role;
  return userRole !== "owner" && userRole !== "admin";
});

const muteAllHintText = computed(() => {
  if (!props.activeContact) return "全员禁言中";
  const userRole = props.activeContact.role;
  if (userRole === "owner") {
    return "全员禁言中（群主可发言）";
  } else if (userRole === "admin") {
    return "全员禁言中（管理员可发言）";
  } else {
    return "全员禁言中";
  }
});

const hexToRgb = (hex: string): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : "22, 93, 255";
};

// ==================== 引用回复预览 ====================

const replySenderName = computed(() => {
  const t = props.replyTarget;
  if (!t) return "";
  return t.sender?.nickname || t.sender?.username || t.senderName || "";
});

const replyPreviewText = computed(() => {
  const t = props.replyTarget;
  if (!t) return "";
  if (t.messageType === "image") return "[图片]";
  if (t.messageType === "video") return "[视频]";
  if (t.messageType === "file") return "[文件]";
  return t.content || "";
});

// ==================== 工具按钮事件 ====================

const handleToggleEmojiPicker = () => {
  if (props.readonly || shouldShowMuteAllHint.value || isBlockedComputed.value) return;
  const newState = !showEmojiPicker.value;
  showEmojiPicker.value = newState;
  emit("toggle-emoji-picker");
};

const handleVoiceMessage = () => {
  if (props.readonly || shouldShowMuteAllHint.value || isBlockedComputed.value) return;
  if (isVoiceMode.value) {
    handleExitVoiceMode();
  } else {
    enterVoiceMode();
  }
};

const enterVoiceMode = () => {
  isVoiceMode.value = true;
  isVoiceRecording.value = false;
  voiceRecordingDuration.value = 0;
  document.addEventListener("keydown", handleVoiceKeyDown);
  document.addEventListener("keyup", handleVoiceKeyUp);
};

const handleExitVoiceMode = () => {
  isVoiceMode.value = false;
  isVoiceRecording.value = false;
  voiceRecordingDuration.value = 0;
  document.removeEventListener("keydown", handleVoiceKeyDown);
  document.removeEventListener("keyup", handleVoiceKeyUp);
  if (audioRecorder.value && isVoiceRecording.value) {
    audioRecorder.value.cancelRecording();
  }
};

// 语音录制相关
const audioRecorder = ref<AudioRecorder | null>(null);

const handleVoiceKeyDown = async (event: KeyboardEvent) => {
  if (event.code === "Space" && isVoiceMode.value && !isVoiceRecording.value) {
    event.preventDefault();
    await startVoiceRecording();
  } else if (event.key === "Escape" && isVoiceMode.value) {
    event.preventDefault();
    handleExitVoiceMode();
  }
};

const handleVoiceKeyUp = async (event: KeyboardEvent) => {
  if (event.code === "Space" && isVoiceRecording.value) {
    event.preventDefault();
    await stopVoiceRecording();
  }
};

const startVoiceRecording = async () => {
  try {
    isVoiceRecording.value = true;
    voiceRecordingDuration.value = 0;

    audioRecorder.value = new AudioRecorder(
      () => {
        console.log("开始录音");
      },
      async (audioBlob: Blob) => {
        isVoiceRecording.value = false;
        const duration = await getAudioDuration(audioBlob);
        console.log("录音完成，时长:", duration);
        message.success("语音录制完成");
        handleExitVoiceMode();
      },
      (error: Error) => {
        isVoiceRecording.value = false;
        voiceRecordingDuration.value = 0;
        message.error(`录音失败: ${error.message}`);
      },
      (duration: number) => {
        voiceRecordingDuration.value = duration;
      },
    );

    await audioRecorder.value.startRecording();
  } catch (error: any) {
    isVoiceRecording.value = false;
    voiceRecordingDuration.value = 0;
    message.error(`无法开始录音: ${error.message}`);
  }
};

const stopVoiceRecording = async () => {
  if (audioRecorder.value && isVoiceRecording.value) {
    audioRecorder.value.stopRecording();
  }
};

const handleScreenCapture = async () => {
  if (props.readonly || shouldShowMuteAllHint.value || isBlockedComputed.value) {
    message.warning(
      props.theyBlockedMe
        ? "对方已将你拉黑，无法使用截图功能"
        : props.iBlockedThem
          ? "你已拉黑对方，无法使用截图功能"
          : "全员禁言中，无法使用截图功能",
    );
    return;
  }
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      message.error("您的浏览器不支持截图功能，请升级到最新版本");
      return;
    }
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    });
    const video = document.createElement("video");
    video.srcObject = stream;
    video.autoplay = true;
    video.onloadedmetadata = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        message.error("截图失败：无法获取画布上下文");
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(async (blob) => {
        if (!blob) {
          message.error("截图失败：无法转换为图片文件");
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const timestamp = new Date().getTime();
        const file = new File([blob], `截图_${timestamp}.png`, {
          type: "image/png",
        });
        const previewUrl = URL.createObjectURL(blob);
        const screenshot: SelectedImage = {
          id: `screenshot_${timestamp}`,
          previewUrl,
          file,
          isScreenshot: true,
          mediaType: "image",
        };
        emit("add-screenshot", screenshot);
        message.success("截图成功，可直接发送");
        stream.getTracks().forEach((track) => track.stop());
      }, "image/png");
    };
  } catch (error) {
    if ((error as Error).name === "NotAllowedError") {
      message.warning("您拒绝了屏幕捕获权限，无法完成截图");
    } else {
      message.error(`截图失败：${(error as Error).message}`);
    }
  }
};

const handleSelectMedia = () => {
  if (props.readonly || shouldShowMuteAllHint.value || isBlockedComputed.value) {
    message.warning(
      props.theyBlockedMe
        ? "对方已将你拉黑，无法发送图片"
        : props.iBlockedThem
          ? "你已拉黑对方，无法发送图片"
          : "全员禁言中，无法发送图片",
    );
    return;
  }
  emit("select-media");
};

const handleSelectFile = () => {
  if (props.readonly || shouldShowMuteAllHint.value || isBlockedComputed.value) {
    message.warning(
      props.theyBlockedMe
        ? "对方已将你拉黑，无法发送文件"
        : props.iBlockedThem
          ? "你已拉黑对方，无法发送文件"
          : "全员禁言中，无法发送文件",
    );
    return;
  }
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;
  input.style.display = "none";
  input.onchange = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (files && files.length > 0) {
      emit("select-file", Array.from(files));
    }
    document.body.removeChild(input);
  };
  document.body.appendChild(input);
  input.click();
};

// ==================== 文本提取和输入处理 ====================

const extractPureTextContent = (): string => {
  if (!messageTextareaRef.value) return "";
  return messageTextareaRef.value.innerText?.trim() || "";
};

const handleInput = (e: InputEvent) => {
  if (messageTextareaRef.value) {
    const text = extractPureTextContent();
    currentInputText.value = text;
    emit("update:new-message", text);
    sendTypingStatus(text.length > 0);
  }
  updateMentionState();
};

// ==================== @ 提及群成员 ====================

type GroupMember = NonNullable<Contact["groupMembers"]>[number];

const inputWrapperRef = ref<HTMLElement | null>(null);
const showMentionPanel = ref(false);
const mentionQuery = ref("");
const mentionActiveIndex = ref(0);
const mentionPanelStyle = ref<Record<string, string>>({ left: "8px", bottom: "0px" });
const mentionLoading = ref(false);
/** 已按需补拉过成员的群ID（避免反复请求空结果的群） */
const mentionLoadedGroupIds = new Set<string>();
/** 补拉到的成员本地兜底（父级 contact 非响应式时也能刷新面板） */
const mentionFallbackMembers = ref<GroupMember[]>([]);
const mentionFallbackGroupId = ref("");

/** 夜间模式：面板切换为深色 */
const isDarkMode = computed(() => !!siderColorStore.systemPrefersDark);

const memberDisplayName = (member: GroupMember): string =>
  member.nickname || member.name || "";

const memberKey = (member: any): string =>
  String(member?.id ?? member?.userId ?? member?.user?.id ?? "").trim();

/** 群ID：优先 groupOwnerId，其次 owner.id，最后成员里的 role==='owner' */
const ownerIds = computed<Set<string>>(() => {
  const contact = props.activeContact;
  const ids = new Set<string>();
  const add = (value: any) => {
    const id = String(value ?? "").trim();
    if (id) ids.add(id);
  };
  add((contact as any)?.groupOwnerId);
  add((contact as any)?.owner?.id);
  (contact?.groupMembers || []).forEach((m: any) => {
    if (String(m?.role || "").toLowerCase() === "owner") add(memberKey(m));
  });
  return ids;
});

/** 管理员ID：contact.admin（后端权威） ∪ 成员里 role==='admin' */
const adminIds = computed<Set<string>>(() => {
  const contact = props.activeContact;
  const ids = new Set<string>();
  ((contact as any)?.admin || []).forEach((a: any) => {
    const id = memberKey(a);
    if (id) ids.add(id);
  });
  (contact?.groupMembers || []).forEach((m: any) => {
    if (String(m?.role || "").toLowerCase() === "admin") {
      const id = memberKey(m);
      if (id) ids.add(id);
    }
  });
  return ids;
});

/** 机器人判定：成员带 isBot / category='robot' / tags 含机器人 */
const isBotMember = (member: any): boolean =>
  member?.isBot === true ||
  member?.category === "robot" ||
  (Array.isArray(member?.tags) &&
    member.tags.some((tag: any) => /机器人|robot/i.test(String(tag ?? ""))));

type MentionRole = "owner" | "admin" | "bot" | "member";

const resolveMentionRole = (member: GroupMember): MentionRole => {
  const id = memberKey(member);
  const role = String(member.role || "").toLowerCase();
  if (role === "owner" || (id && ownerIds.value.has(id))) return "owner";
  if (role === "admin" || (id && adminIds.value.has(id))) return "admin";
  if (isBotMember(member)) return "bot";
  return "member";
};

const memberRoleLabel = (member: GroupMember): string => {
  const role = resolveMentionRole(member);
  if (role === "owner") return "群主";
  if (role === "admin") return "管理员";
  return "";
};

/** 当前登录用户自己（列表里不去掉，只加「我」徽标，避免看到「没有管理员」的困惑） */
const isSelfMember = (member: GroupMember): boolean => {
  const selfId = String(props.currentUserId || "").trim();
  return !!selfId && memberKey(member) === selfId;
};

/** 候选成员：群成员 + 仅存在于 contact.admin/owner 的角色成员，按角色排序后过滤 */
const mentionCandidates = computed<GroupMember[]>(() => {
  const contact = props.activeContact;
  if (!contact?.isGroup) return [];
  const source = contact.groupMembers?.length
    ? contact.groupMembers
    : mentionFallbackGroupId.value === String(contact.id)
      ? mentionFallbackMembers.value
      : [];
  const members: GroupMember[] = [...source];

  const exists = (id: string) => !!id && members.some((m) => memberKey(m) === id);
  const mergeRoleMember = (raw: any, role: "owner" | "admin") => {
    const id = memberKey(raw);
    if (!id || exists(id)) return;
    members.push({
      id,
      name: raw?.name ?? raw?.nickname ?? (role === "owner" ? "群主" : "管理员"),
      avatar: raw?.avatar ?? "",
      nickname: raw?.nickname ?? null,
      role,
    } as GroupMember);
  };
  ((contact as any).admin || []).forEach((a: any) => mergeRoleMember(a, "admin"));
  if ((contact as any).owner) mergeRoleMember((contact as any).owner, "owner");

  const keyword = mentionQuery.value.trim().toLowerCase();
  const filtered = members.filter(
    (m) =>
      !keyword ||
      memberDisplayName(m).toLowerCase().includes(keyword) ||
      memberKey(m) === keyword,
  );

  const weight: Record<MentionRole, number> = { owner: 0, admin: 1, bot: 2, member: 3 };
  filtered.sort((a, b) => weight[resolveMentionRole(a)] - weight[resolveMentionRole(b)]);
  return filtered.slice(0, 50);
});

/** 光标前命中「@ + 关键字」的匹配规则（关键字内不含空格） */
const MENTION_TAIL_RE = /@([^\s@\u3000]{0,20})$/;

/**
 * 群成员按需补拉：联系人列表缓存会剥离 groupMembers，
 * 首屏从缓存渲染时群成员可能为空，打开 @ 面板时补一次。
 */
const ensureGroupMembers = async () => {
  const contact = props.activeContact;
  if (!contact?.isGroup) return;
  const groupId = String(contact.id);
  if (Array.isArray(contact.groupMembers) && contact.groupMembers.length > 0) return;
  if (mentionLoading.value || mentionLoadedGroupIds.has(groupId)) return;

  mentionLoadedGroupIds.add(groupId);
  mentionLoading.value = true;
  try {
    const { fetchGroupDetail } = await import("../untils/messageManager");
    const data = await fetchGroupDetail(groupId);
    if (Array.isArray(data?.members) && data.members.length > 0) {
      const members: GroupMember[] = data.members.map((m: any) => ({
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
        category: m.category,
      }));
      contact.groupMembers = members;
      mentionFallbackGroupId.value = groupId;
      mentionFallbackMembers.value = members;
      if (!contact.memberCount) {
        contact.memberCount = data.memberCount ?? data.members.length;
      }
      // 角色兜底：后端可能只在 admin/owner 字段返回角色，@ 面板据此标注
      const contactAny = contact as any;
      if (Array.isArray(data.admin) && data.admin.length > 0 && !contactAny.admin?.length) {
        contactAny.admin = data.admin;
      }
      if (data.owner) {
        if (!contactAny.owner) contactAny.owner = data.owner;
        if (!contactAny.groupOwnerId && data.owner.id) {
          contactAny.groupOwnerId = String(data.owner.id);
        }
      }
    }
  } catch (error) {
    mentionLoadedGroupIds.delete(groupId);
    console.warn("[MessageInputArea] 拉取群成员失败:", error);
  } finally {
    mentionLoading.value = false;
  }
};

/** 取光标前的纯文本（textContent 语义，不含隐式换行） */
const getTextBeforeCaret = (): string | null => {
  const el = messageTextareaRef.value;
  if (!el) return null;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  const range = selection.getRangeAt(0);
  if (!range.collapsed || !el.contains(range.startContainer)) return null;
  const preRange = range.cloneRange();
  preRange.selectNodeContents(el);
  preRange.setEnd(range.startContainer, range.startOffset);
  return preRange.toString();
};

/** 命中「@ + 关键字」时打开面板 */
const updateMentionState = () => {
  if (props.readonly || shouldShowMuteAllHint.value || isBlockedComputed.value) {
    closeMentionPanel();
    return;
  }
  if (!props.activeContact?.isGroup) {
    closeMentionPanel();
    return;
  }
  const before = getTextBeforeCaret();
  if (before === null) return;
  const match = MENTION_TAIL_RE.exec(before);
  if (!match) {
    closeMentionPanel();
    return;
  }
  mentionQuery.value = match[1];
  mentionActiveIndex.value = 0;
  showMentionPanel.value = true;
  nextTick(positionMentionPanel);
  if (!props.activeContact.groupMembers?.length) {
    void ensureGroupMembers();
  }
};

const closeMentionPanel = () => {
  if (!showMentionPanel.value) return;
  showMentionPanel.value = false;
  mentionQuery.value = "";
  mentionActiveIndex.value = 0;
};

/** 面板跟随光标定位（在 .message-input-wrapper 内绝对定位） */
const positionMentionPanel = () => {
  const el = messageTextareaRef.value;
  const wrapper = inputWrapperRef.value;
  if (!el || !wrapper) return;
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;
  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(true);
  let rect = range.getBoundingClientRect();
  if (!rect || (!rect.width && !rect.height && !rect.top && !rect.left)) {
    rect = el.getBoundingClientRect();
  }
  const wrapperRect = wrapper.getBoundingClientRect();
  const panelWidth = 220;
  const left = Math.min(
    Math.max(rect.left - wrapperRect.left, 8),
    Math.max(wrapperRect.width - panelWidth - 8, 8),
  );
  mentionPanelStyle.value = {
    left: `${left}px`,
    bottom: `${Math.max(wrapperRect.bottom - rect.top + 6, 28)}px`,
  };
};

/** 把光标前的「@关键字」替换为「@昵称 」 */
const insertMention = (member: GroupMember) => {
  const el = messageTextareaRef.value;
  const selection = window.getSelection();
  if (!el || !selection || selection.rangeCount === 0) {
    closeMentionPanel();
    return;
  }
  const before = getTextBeforeCaret();
  if (before === null) {
    closeMentionPanel();
    return;
  }
  const match = MENTION_TAIL_RE.exec(before);
  if (!match) {
    closeMentionPanel();
    return;
  }
  const caret = selection.getRangeAt(0);
  const startOffset = before.length - match[1].length - 1;
  const startPos = locateTextOffset(el, startOffset);
  if (!startPos) {
    closeMentionPanel();
    return;
  }
  const range = document.createRange();
  range.setStart(startPos.node, startPos.offset);
  range.setEnd(caret.startContainer, caret.startOffset);
  range.deleteContents();
  const textNode = document.createTextNode(`@${memberDisplayName(member)} `);
  range.insertNode(textNode);
  const after = document.createRange();
  after.setStart(textNode, textNode.data.length);
  after.collapse(true);
  selection.removeAllRanges();
  selection.addRange(after);
  closeMentionPanel();
  el.focus();
  syncInputState();
};

/** 在元素 textContent 中定位偏移量对应的文本节点位置 */
const locateTextOffset = (
  el: HTMLElement,
  offset: number,
): { node: Text; offset: number } | null => {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let node = walker.nextNode() as Text | null;
  while (node) {
    const length = node.data.length;
    if (consumed + length >= offset) return { node, offset: offset - consumed };
    consumed += length;
    node = walker.nextNode() as Text | null;
  }
  return null;
};

const syncInputState = () => {
  const text = extractPureTextContent();
  currentInputText.value = text;
  emit("update:new-message", text);
  sendTypingStatus(text.length > 0);
};

const moveMentionActive = (step: number) => {
  const total = mentionCandidates.value.length;
  if (total === 0) return;
  mentionActiveIndex.value = (mentionActiveIndex.value + step + total) % total;
};

/** 左右方向键 / Home / End 改变光标位置后重新判断面板 */
const handleInputKeyUp = (event: KeyboardEvent) => {
  if (!showMentionPanel.value) return;
  if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
    updateMentionState();
  }
};

const handleCaretMoved = () => {
  if (showMentionPanel.value) updateMentionState();
};

const handleInputBlur = () => {
  closeMentionPanel();
};

// ==================== 发送消息 ====================

const handleSendMessage = async () => {
  if (props.readonly || shouldShowMuteAllHint.value) {
    message.warning("全员禁言中，无法发送消息");
    return;
  }

  if (props.theyBlockedMe) {
    message.warning("对方已将你拉黑，无法发送消息");
    return;
  }
  if (props.iBlockedThem) {
    message.warning("你已拉黑对方，无法发送消息，请先取消拉黑");
    return;
  }

  const pureTextContent = extractPureTextContent();
  const hasTextContent = pureTextContent.trim().length > 0;
  const hasMediaContent = props.selectedImages.length > 0 || props.selectedVideos.length > 0;
  const hasFileContent = props.selectedFiles && props.selectedFiles.length > 0;
  const hasContent = hasTextContent || hasMediaContent || hasFileContent;

  if (!hasContent) {
    return;
  }

  const payload = {
    text: hasTextContent ? pureTextContent : undefined,
    images: hasMediaContent ? [...props.selectedImages] : undefined,
    videos: hasMediaContent ? [...props.selectedVideos] : undefined,
    files: hasFileContent ? (props.selectedFiles ? [...props.selectedFiles] : []) : undefined,
    hasText: hasTextContent,
    hasMedia: hasMediaContent,
    hasFiles: hasFileContent,
  };

  if (hasTextContent) {
    emit("update:new-message", pureTextContent);
  }

  emit("send-message", payload);

  // 清空输入框
  if (messageTextareaRef.value) {
    messageTextareaRef.value.innerText = "";
    currentInputText.value = "";
  }
  closeMentionPanel();

  if (props.scrollToBottom) {
    await nextTick();
    props.scrollToBottom();
  }
};

// ==================== 打字状态 ====================

const sendTypingStatus = async (isTyping: boolean) => {
  if (isTyping === lastTypingStatus) return;
  if (typingTimeoutTimer) clearTimeout(typingTimeoutTimer);
  try {
    const { websocketService } = await import("../untils/websocket");
    if (props.activeContact && !props.activeContact.isGroup) {
      websocketService.sendTypingStatus({
        targetId: String(props.activeContact.id),
        isTyping,
      });
      lastTypingStatus = isTyping;
    }
    if (isTyping) {
      typingTimeoutTimer = setTimeout(() => {
        sendTypingStatus(false);
      }, 3000);
    }
  } catch (error) {
    console.error("[MessageInputArea] 发送正在输入状态失败:", error);
  }
};

// ==================== 表情插入 ====================

const handleInsertEmoji = (emoji: string) => {
  if (!messageTextareaRef.value) return;
  messageTextareaRef.value.focus();

  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (range.toString()) range.deleteContents();
    const emojiNode = document.createTextNode(emoji);
    range.insertNode(emojiNode);
    range.setStartAfter(emojiNode);
    range.setEndAfter(emojiNode);
    selection.removeAllRanges();
    selection.addRange(range);
  } else {
    messageTextareaRef.value.appendChild(document.createTextNode(emoji));
  }

  const newMessage = messageTextareaRef.value.innerText || "";
  currentInputText.value = newMessage;
  emit("update:new-message", newMessage);
  const inputEvent = new InputEvent("input", {
    bubbles: true,
    cancelable: true,
  });
  messageTextareaRef.value.dispatchEvent(inputEvent);
};

// ==================== 预览事件 ====================

const handlePreviewTempImage = (image: SelectedImage, index: number) => {
  emit("preview-temp-image", image, index);
};

const handlePreviewTempVideo = (video: SelectedVideo, index: number) => {
  emit("preview-temp-video", video, index);
};

const handlePlayVideoOnHover = (event: MouseEvent) => {
  emit("play-video-on-hover", event);
};

const handlePauseVideoOnLeave = (event: MouseEvent) => {
  emit("pause-video-on-leave", event);
};

const handlePreviewFile = (file: SelectedFileItem) => {
  emit("preview-file", file);
};

// ==================== 发送按钮状态 ====================

const isSendButtonEnabled = computed(() => {
  if (props.readonly || shouldShowMuteAllHint.value || isBlockedComputed.value) {
    return false;
  }

  const hasTextContent = currentInputText.value.trim().length > 0;
  const hasMediaContent = props.selectedImages.length > 0 || props.selectedVideos.length > 0;
  const hasFileContent = props.selectedFiles && props.selectedFiles.length > 0;

  return hasTextContent || hasMediaContent || hasFileContent;
});

// ==================== 生命周期 ====================

onMounted(() => {
  // 初始化逻辑
});

onUnmounted(() => {
  document.removeEventListener("keydown", handleVoiceKeyDown);
  document.removeEventListener("keyup", handleVoiceKeyUp);
  if (typingTimeoutTimer) {
    clearTimeout(typingTimeoutTimer);
    typingTimeoutTimer = null;
  }
  if (audioRecorder.value) {
    audioRecorder.value.cancelRecording();
  }
});

defineExpose({
  messageTextareaRef,
  handleInsertEmoji,
});
</script>

<style scoped>
.message-input-area {
  padding: 16px;
  height: auto;
  min-height: 100px;
  max-height: 40vh;
  display: flex;
  flex-direction: column;
  background: transparent;
  position: relative;
  --text-primary: v-bind("siderColorStore.currentColorPalette.textPrimary");
}

.readonly-hint {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 14px;
}

.hint-content {
  text-align: center;
}

.hint-text {
  color: var(--text-primary);
  font-weight: 500;
}

.input-tools {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.input-tools-right {
  display: flex;
  gap: 8px;
}

.input-tool-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  color: #5f5f5f;
}

.input-tool-btn:hover {
  background-color: var(--theme-light);
}

.tool-icon {
  font-size: 20px;
  color: #5f5f5f;
}

/* 动态主题（个性装扮）下图标用壁纸吸色渲染，跟随壁纸主色而非固定白色 */
.message-input-area.has-dynamic-bg .tool-icon {
  color: var(--dt-accent-icon, #ffffff);
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.45));
}

.message-input-area.has-dynamic-bg .input-tool-btn:hover {
  background-color: var(--dt-accent-bg, transparent);
}

.message-input-wrapper {
  position: relative;
  flex: 1;
  margin-top: 8px;
}

.reply-preview-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  margin-bottom: 8px;
  background: var(--theme-light, rgba(0, 0, 0, 0.05));
  border-left: 3px solid var(--theme-primary-rgb, #165dff);
  border-radius: 6px;
  font-size: 12px;
}

.reply-preview-content {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.reply-preview-label {
  color: var(--text-primary, #1a1a2e);
  font-weight: 500;
  flex-shrink: 0;
}

.reply-preview-text {
  color: var(--text-secondary, #666);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.reply-preview-close {
  flex-shrink: 0;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--text-secondary, #999);
  font-size: 14px;
  line-height: 1;
  padding: 2px 4px;
}

.reply-preview-close:hover {
  color: var(--danger-color, #ff3b30);
}

/* ==================== @ 提及成员面板 ==================== */
.mention-panel {
  position: absolute;
  z-index: 1002;
  width: 220px;
  max-height: 240px;
  display: flex;
  flex-direction: column;
  background: var(--dt-panel-solid, var(--card-bg, #fff));
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  box-shadow:
    0 6px 24px -6px rgba(0, 0, 0, 0.18),
    0 2px 6px rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.mention-panel.is-dark {
  background: #2c2c2e;
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow:
    0 6px 24px -6px rgba(0, 0, 0, 0.5),
    0 2px 6px rgba(0, 0, 0, 0.3);
}

.mention-panel-title {
  flex-shrink: 0;
  padding: 7px 10px;
  font-size: 11px;
  color: #9ca3af;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}

.mention-panel.is-dark .mention-panel-title {
  color: #8e8e93;
  border-bottom-color: rgba(255, 255, 255, 0.08);
}

.mention-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 4px;
}

.mention-list::-webkit-scrollbar {
  width: 4px;
}

.mention-list::-webkit-scrollbar-thumb {
  background: var(--theme-light, rgba(0, 0, 0, 0.15));
  border-radius: 2px;
}

.mention-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 6px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #1f2937;
  user-select: none;
}

.mention-item.active {
  background: rgba(0, 0, 0, 0.06);
}

.mention-panel.is-dark .mention-item {
  color: #e5e7eb;
}

/* 动态壁纸下保持可读：命中块用半透明深底 */
.message-input-area.has-dynamic-bg .mention-item.active,
.message-input-area.has-dynamic-bg .mention-item:hover {
  background: rgba(0, 0, 0, 0.28);
}

.mention-panel.is-dark .mention-item.active {
  background: rgba(255, 255, 255, 0.1);
}

.mention-avatar {
  flex-shrink: 0;
}

.mention-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.mention-role {
  flex-shrink: 0;
  padding: 1px 6px;
  font-size: 11px;
  border-radius: 4px;
}

.mention-role.tone-owner {
  color: #e5484d;
  background: rgba(229, 72, 77, 0.12);
}

.mention-role.tone-admin {
  color: #165dff;
  background: rgba(22, 93, 255, 0.1);
}

.mention-role.tone-bot {
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.12);
}

.mention-role.tone-self {
  color: #6b7280;
  background: rgba(107, 114, 128, 0.14);
}

.mention-empty {
  padding: 12px 8px;
  text-align: center;
  font-size: 12px;
  color: #9ca3af;
}

/* 动态主题（个性装扮）下引用条转半透明深底 + 白字 */
.message-input-area.has-dynamic-bg .reply-preview-bar {
  background: rgba(0, 0, 0, 0.28);
  border-left-color: rgba(255, 255, 255, 0.6);
}
.message-input-area.has-dynamic-bg .reply-preview-label,
.message-input-area.has-dynamic-bg .reply-preview-text {
  color: var(--dt-text);
  text-shadow: var(--dt-text-shadow);
}

.message-input-container {
  border-radius: 12px;
  background: transparent;
}

.message-input-content {
  min-height: 80px;
  max-height: 200px;
  overflow-y: auto;
  outline: none;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-primary);
  white-space: pre-wrap;
  word-wrap: break-word;
}

/* 空状态占位 */
.message-input-content:empty::before {
  content: attr(data-placeholder);
  color: var(--text-tertiary);
  pointer-events: none;
}

.send-hint {
  position: absolute;
  right: 12px;
  bottom: 12px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 20px;
  backdrop-filter: blur(4px);
  pointer-events: auto;
}

.send-hint-text {
  user-select: none;
  color: var(--text-primary);
}

.send-hint-divider {
  color: var(--text-primary);
}

.emoji-picker {
  position: absolute;
  bottom: 100%;
  left: 0;
  margin-bottom: 8px;
  z-index: 1001;
}

/* 滚动条样式 */
.message-input-content::-webkit-scrollbar {
  width: 4px;
}

.message-input-content::-webkit-scrollbar-track {
  background: transparent;
}

.message-input-content::-webkit-scrollbar-thumb {
  background: var(--theme-light);
  border-radius: 2px;
}
</style>
