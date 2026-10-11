import { message as antMessage } from "ant-design-vue";
import request from "./request";
import { handleSendMessage } from "./contactManager";
import type { ChatMessage, Contact } from "../types/chatTypes";

/**
 * 转发消息工具。
 *
 * 后端目前没有独立的「转发」接口，这里复用现有发送链路：
 *  - 文本类消息：把原 content 直接以 text 类型发到目标会话；
 *  - 媒体类消息（图片 / 视频 / 文件）：content 是已上传的资源 URL，
 *    而发送接口只认「临时文件目录」里的 tempFilename，
 *    所以需要先下载远端资源 → 上传到 /message/temp-file → 拿 tempFilename 再发送。
 *
 * 注意：媒体消息对每个目标都单独上传一次临时文件，
 * 避免后端发送后移动 / 清理临时文件导致第二个目标转发失败。
 */

/** 可直接原样复制 content 转发的类型 */
const PLAIN_FORWARD_TYPES = [
  "text",
  "link",
  "system",
  "call",
  "share_user_card",
  "share_group_card",
];

/** 需要重新上传成临时文件才能转发的媒体类型 */
const MEDIA_FORWARD_TYPES = ["image", "video", "file"];

interface MediaSource {
  url: string;
  filename: string;
  size?: number;
}

/** 从消息 content 里解析出媒体地址与文件名 */
function resolveMediaSource(msg: ChatMessage): MediaSource | null {
  const raw: any = msg.content;
  if (!raw) return null;

  // 文件消息 content 形如 { url, filename, size } 的 JSON
  if (msg.messageType === "file") {
    try {
      const obj = typeof raw === "string" ? JSON.parse(raw) : raw;
      if (obj?.url) {
        return {
          url: String(obj.url),
          filename: obj.filename || msg.fileName || String(obj.url).split("/").pop() || "file",
          size: obj.size ?? msg.fileSize,
        };
      }
    } catch {
      // 不是 JSON，按纯 URL 处理
    }
  }

  const url = typeof raw === "string" ? raw : String(raw?.url ?? "");
  if (!url) return null;

  let filename = msg.fileName || "";
  if (!filename) {
    try {
      filename = decodeURIComponent(url.split("?")[0].split("/").pop() || "");
    } catch {
      filename = url.split("/").pop() || "";
    }
  }

  return {
    url,
    filename: filename || `转发${msg.messageType === "video" ? "视频" : msg.messageType === "file" ? "文件" : "图片"}`,
    size: msg.fileSize,
  };
}

/** 把消息里的资源地址补成绝对地址（后端返回的是完整 URL，这里兜底相对路径） */
function resolveAbsoluteUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  let base = "http://localhost:8080";
  try {
    base = localStorage.getItem("api-url") || base;
  } catch {
    /* 无 localStorage 时用默认后端地址 */
  }
  return `${base.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
}

/**
 * 下载远端资源为 File。
 *
 * 只下载一次：之前是「每个转发目标都重新下载 + 上传」，
 * 转发视频时会重复拉取几百 MB，既慢又占内存。
 */
async function downloadMediaFile(source: MediaSource): Promise<File | null> {
  try {
    const res = await fetch(resolveAbsoluteUrl(source.url));
    if (!res.ok) throw new Error(`下载失败：HTTP ${res.status}`);

    const blob = await res.blob();
    return new File([blob], source.filename, {
      type: blob.type || "application/octet-stream",
    });
  } catch (e) {
    console.error("[forwardMessage] 下载媒体资源失败:", e);
    return null;
  }
}

/**
 * 临时上传端点与字段名：**必须按消息类型分流**。
 *
 * 后端三个端点的 multer 过滤器是彼此独立的：
 *  `/message/temp-file`（FileHandler）只放行文档 / 压缩包 / 文本，
 *  图片（image/*）和视频（video/*）会被它的 fileFilter 判为
 *  「不支持的文件类型!」直接抛错 ——
 *  表现就是转发图片 / 视频时日志里 `POST /message/temp-file 500`。
 */
const TEMP_UPLOAD_TARGETS: Record<
  string,
  { endpoint: string; field: string }
> = {
  image: { endpoint: "/message/temp-image", field: "image" },
  video: { endpoint: "/message/temp-video", field: "video" },
  file: { endpoint: "/message/temp-file", field: "files" },
};

/** 上传 File 为后端临时文件，返回 tempFilename 与大小 */
async function uploadAsTempFile(
  file: File,
  source: MediaSource,
  messageType: string,
): Promise<{ tempFilename: string; size: number } | null> {
  const target = TEMP_UPLOAD_TARGETS[messageType] || TEMP_UPLOAD_TARGETS.file;
  try {
    const formData = new FormData();
    formData.append(target.field, file);

    const response = await request.post(target.endpoint, formData);
    const data = response.data;
    const tempFilename = data?.filenames?.[0];
    if (!tempFilename) throw new Error("服务端未返回临时文件名");

    return {
      tempFilename,
      size: data?.sizes?.[0] ?? file.size ?? source.size ?? 0,
    };
  } catch (e) {
    console.error("[forwardMessage] 上传临时文件失败:", e);
    return null;
  }
}

export interface ForwardOptions {
  contacts: Contact[];
  currentUserId: string | number;
  userStore: any;
  rightChatAreaRef?: any;
}

/**
 * 把一条消息转发到若干目标会话。
 * @returns 成功 / 失败的目标数量
 */
export async function forwardMessageToTargets(
  msg: ChatMessage,
  targetIds: (string | number)[],
  options: ForwardOptions,
): Promise<{ success: number; failed: number }> {
  if (!msg || !targetIds.length) return { success: 0, failed: 0 };

  const type = msg.messageType || "text";
  const isMedia = MEDIA_FORWARD_TYPES.includes(type);

  // 媒体消息：先解析地址并下载一次原文件；失败就整体结束，
  // 不必让每个目标都重试一遍（原来每个目标都重新下载上传）
  let mediaSource: MediaSource | null = null;
  let mediaFile: File | null = null;
  if (isMedia) {
    mediaSource = resolveMediaSource(msg);
    if (!mediaSource) {
      antMessage.error("该消息缺少可转发的资源地址");
      return { success: 0, failed: targetIds.length };
    }

    mediaFile = await downloadMediaFile(mediaSource);
    if (!mediaFile) {
      antMessage.error("无法读取原文件，转发失败（请检查资源地址是否可访问）");
      return { success: 0, failed: targetIds.length };
    }
  }

  let success = 0;
  let failed = 0;

  for (const targetId of targetIds) {
    const sendOpts: any = {
      contacts: options.contacts,
      activeContactId: String(targetId),
      currentUserId: String(options.currentUserId),
      rightChatAreaRef: options.rightChatAreaRef,
    };

    try {
      if (isMedia && mediaFile && mediaSource) {
        // 每个目标单独上传一份临时文件：后端发送后会移动 / 清理临时文件，
        // 复用同一个文件名会导致第二个目标发送失败
        const uploaded = await uploadAsTempFile(mediaFile, mediaSource, type);
        if (!uploaded) {
          failed += 1;
          continue;
        }

        await handleSendMessage(
          targetId,
          "",
          sendOpts,
          options.userStore,
          type,
          undefined,
          [uploaded.tempFilename],
          [mediaSource.filename],
          [uploaded.size],
        );
      } else {
        // 文本 / 名片 / 系统等类型：原样以文本发出
        await handleSendMessage(targetId, msg.content, sendOpts, options.userStore, PLAIN_FORWARD_TYPES.includes(type) ? type : "text");
      }

      success += 1;
    } catch (e) {
      console.error("[forwardMessage] 转发失败:", e);
      failed += 1;
    }
  }

  return { success, failed };
}

/**
 * 批量转发：把多条消息转发到若干目标会话。
 *
 * 内部按「消息 × 目标」逐条发送，媒体消息会各自重新上传临时文件。
 * @returns success / failed 为「消息-目标对」的计数
 */
export async function forwardMessagesToTargets(
  messages: ChatMessage[],
  targetIds: (string | number)[],
  options: ForwardOptions,
): Promise<{ success: number; failed: number }> {
  const list = (messages || []).filter(Boolean);
  if (!list.length || !targetIds.length) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;

  for (const msg of list) {
    const result = await forwardMessageToTargets(msg, targetIds, options);
    success += result.success;
    failed += result.failed;
  }

  return { success, failed };
}

/** 生成消息在转发弹窗里的预览摘要 */
export function getForwardPreview(msg: ChatMessage | null): string {
  if (!msg) return "";
  const type = msg.messageType || "text";

  if (type === "image") return "[图片]";
  if (type === "video") return "[视频]";
  if (type === "file") {
    try {
      const obj = typeof msg.content === "string" ? JSON.parse(msg.content) : msg.content;
      return `[文件] ${obj?.filename || msg.fileName || ""}`.trim();
    } catch {
      return `[文件] ${msg.fileName || ""}`.trim();
    }
  }
  if (type === "share_user_card") return "[好友名片]";
  if (type === "share_group_card") return "[群名片]";
  if (type === "call") return `[通话] ${msg.content || ""}`;
  if (type === "system") return "[系统消息]";

  const text = (msg.content || "").replace(/\s+/g, " ").trim();
  return text.length > 40 ? `${text.slice(0, 40)}…` : text;
}
