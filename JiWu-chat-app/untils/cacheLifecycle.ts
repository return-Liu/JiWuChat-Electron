import { clearContactsCache } from "./contactCache";
import { clearFriendListCache } from "./friendListCache";
import { resetContactManagerCaches } from "./contactManager";
import { clearLatestMessagesCache } from "./messageManager";

/**
 * 账号级缓存生命周期统一入口。
 *
 * 背景：联系人 / 好友 / 最近消息等模块各自持有模块级缓存（Map + localStorage），
 * 之前登出 / 切换账号时由 userStore.logout 手动逐个调用清理函数，容易遗漏。
 * 这里把所有「账号级」缓存的清理收口到一处，登出 / 切换账号时统一调用。
 */
export const clearAllAccountCaches = (): void => {
  // 联系人缓存（contactCache）
  clearContactsCache();
  // 好友列表缓存（friendListCache）
  clearFriendListCache();
  // 联系人管理器缓存：置顶/免打扰、JSON 解析缓存、原始顺序等
  resetContactManagerCaches();
  // 最近消息缓存（messageManager）
  clearLatestMessagesCache();
};
