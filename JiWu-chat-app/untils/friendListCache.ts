/**
 * 好友 / 群聊列表缓存（供好友页使用）
 *
 * 背景：好友页每次挂载都会请求 /friends 与 /group，在消息页与好友页之间来回切换时
 * 会反复重新拉取，网络慢时列表长时间空白。
 *
 * 策略与联系人缓存一致（stale-while-revalidate）：
 *   命中缓存 → 立即渲染，再静默刷新一次；未命中 → 正常请求后写缓存。
 *
 * 缓存全部自动失效，无需手动清理：超过 TTL、结构版本不匹配、数据校验失败、
 * 写入配额超限（自动清空后重试）都会自动丢弃；登录时会清理其它账号的遗留缓存。
 *
 * 注意：好友页的数据结构是页面内部的 Friend 类型，这里用 any[] 承载，
 * 不与具体页面的类型耦合；key 带 userId，换账号不串数据。
 */

/** 缓存有效期 5 分钟：好友页数据变化较频繁，不适合长 TTL */
const CACHE_TTL = 5 * 60 * 1000;

/** 缓存结构版本：改动缓存结构时 +1，旧缓存自动失效 */
export const CACHE_SCHEMA_VERSION = 1;

/** 单用户写入上限（约 2MB） */
const MAX_CACHE_SIZE = 2 * 1024 * 1024;

const KEY_PREFIX = "friend_list_cache_";

interface FriendListCachePayload {
  v: number;
  ts: number;
  friends: any[];
  groups: any[];
}

/** 内存二级缓存：页面切换时立即命中，无需读 localStorage */
const memoryCache = new Map<string, FriendListCachePayload>();

const cacheKey = (userId: string) => `${KEY_PREFIX}${userId}`;

/** 校验：至少一个列表非空，且都是数组；空结果不缓存，避免把失败结果固化 */
const isValidPayload = (friends: unknown, groups: unknown): boolean =>
  Array.isArray(friends) &&
  Array.isArray(groups) &&
  (friends.length > 0 || groups.length > 0) &&
  friends.every((item) => !!item && item.id !== undefined) &&
  groups.every((item) => !!item && item.id !== undefined);

export const saveFriendListCache = (userId: string, friends: any[], groups: any[]): void => {
  if (!userId || typeof window === "undefined") return;

  if (!isValidPayload(friends, groups)) {
    // 数据异常：自动清除旧缓存，避免继续展示不完整数据
    clearFriendListCache(userId);
    return;
  }

  const payload: FriendListCachePayload = {
    v: CACHE_SCHEMA_VERSION,
    ts: Date.now(),
    friends,
    groups,
  };
  memoryCache.set(userId, payload);

  try {
    const raw = JSON.stringify(payload);
    if (raw.length > MAX_CACHE_SIZE) return;
    localStorage.setItem(cacheKey(userId), raw);
  } catch {
    // 配额超限：清空全部好友缓存后重试一次
    clearFriendListCache();
    try {
      const raw = JSON.stringify(payload);
      if (raw.length <= MAX_CACHE_SIZE) localStorage.setItem(cacheKey(userId), raw);
    } catch {
      /* 忽略 */
    }
  }
};

export const readFriendListCache = (
  userId: string,
): { friends: any[]; groups: any[] } | null => {
  if (!userId) return null;

  const fromMemory = memoryCache.get(userId);
  if (fromMemory) {
    if (fromMemory.v !== CACHE_SCHEMA_VERSION || Date.now() - fromMemory.ts > CACHE_TTL) {
      clearFriendListCache(userId);
      return null;
    }
    return { friends: fromMemory.friends, groups: fromMemory.groups };
  }

  if (typeof window === "undefined") return null;

  try {
    const parsed = JSON.parse(
      localStorage.getItem(cacheKey(userId)) || "null",
    ) as FriendListCachePayload | null;

    // 版本不匹配或数据损坏 → 自动清除
    if (!parsed || parsed.v !== CACHE_SCHEMA_VERSION || !isValidPayload(parsed.friends, parsed.groups)) {
      clearFriendListCache(userId);
      return null;
    }

    if (Date.now() - parsed.ts > CACHE_TTL) {
      clearFriendListCache(userId);
      return null;
    }

    memoryCache.set(userId, parsed);
    return { friends: parsed.friends, groups: parsed.groups };
  } catch {
    clearFriendListCache(userId);
    return null;
  }
};

export const clearFriendListCache = (userId?: string): void => {
  if (userId) memoryCache.delete(userId);
  else memoryCache.clear();

  if (typeof window === "undefined") return;
  try {
    if (userId) {
      localStorage.removeItem(cacheKey(userId));
      return;
    }
    Object.keys(localStorage)
      .filter((key) => key.startsWith(KEY_PREFIX))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    /* 忽略 */
  }
};

/** 登录成功后自动清理其它账号遗留的好友缓存 */
export const pruneOtherUsersCache = (currentUserId: string): void => {
  if (!currentUserId) return;

  memoryCache.forEach((_, key) => {
    if (key !== currentUserId) memoryCache.delete(key);
  });

  if (typeof window === "undefined") return;
  try {
    const keep = cacheKey(currentUserId);
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(KEY_PREFIX) && key !== keep) localStorage.removeItem(key);
    });
  } catch {
    /* 忽略 */
  }
};
