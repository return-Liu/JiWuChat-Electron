
import request from "./request";
import type { Contact } from "../types/chatTypes";

/**
 * 获取当前用户的所有临时会话列表
 */
export const getTemporaryContacts = async (): Promise<Contact[]> => {
  try {
    const response = await request.get("/temporary-contacts");
    const payload = response?.data ?? response;

    // 兼容多种格式：统一格式 data.list / 直接数组 / 旧格式数字键对象
    let contacts: any[] = [];
    if (Array.isArray(payload)) {
      contacts = payload;
    } else if (Array.isArray(payload?.list)) {
      contacts = payload.list;
    } else if (payload && typeof payload === "object") {
      contacts = Object.keys(payload)
        .filter((key) => !isNaN(Number(key)))
        .map((key) => payload[key]);
    }

    return contacts.map((item: any) => ({
      id: item.id,
      isGroup: false,
      avatar: item.avatar || "/default-avatar.png",
      name: item.nickname || item.username || "未知用户",
      username: item.username,
      isOnline: false,
      messages: [],
      lastMessage: "",
      lastMessageTime: "",
      unreadCount: 0,
    }));
  } catch (error) {
    console.error("获取临时会话列表失败:", error);
    return [];
  }
};

/**
 * 创建或更新临时会话
 */
export const createOrUpdateTemporaryContact = async (contactId: number): Promise<any> => {
  try {
    const { data } = await request.post("/temporary-contacts", { contactId });
    return data;
  } catch (error) {
    console.error("创建临时会话失败:", error);
    throw error;
  }
};

/**
 * 删除临时会话
 */
export const deleteTemporaryContact = async (contactId: number): Promise<void> => {
  try {
    await request.delete(`/temporary-contacts/${contactId}`);
  } catch (error) {
    console.error("删除临时会话失败:", error);
    throw error;
  }
};

/**
 * 将临时会话升级为好友（删除临时记录）
 */
export const upgradeToFriend = async (contactId: number): Promise<void> => {
  try {
    await request.put(`/temporary-contacts/${contactId}/upgrade`);
  } catch (error) {
    console.error("升级临时会话失败:", error);
    throw error;
  }
};