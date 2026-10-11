import type { Contact } from "../types/chatTypes";

/**
 * 联系人列表本地缓存（用于登录后首屏秒开）
 *
 * 背景：/message 每次挂载都会全量重拉好友、群聊、临时会话与最近消息，
 * 第二次登录时这些数据往往没变化，却仍要等待整轮网络请求。
 *
 * 策略（stale-while-revalidate）：
 *   1. 命中缓存 → 立即用缓存渲染列表（秒开），同时后台静默拉一次最新数据再覆盖；
 *   2. 未命中/已过期 → 走原逻辑，并在拿到数据后写入缓存。
 *
 * 注意：
 *   - 缓存只保留列表渲染所需的摘要字段，剥离消息明细等大体量且必然过期的数据；
 *   - key 带 userId，换账号不会串数据；登出时由 store 清空；
 *   - 全部读写用 try/catch 包裹，localStorage 不可用（隐私模式 / 配额超限）时静默降级。
 *
 * 缓存全部自动失效，无需用户手动清理，触发时机：
 *   1. 超过 TTL（24h）自动丢弃；
 *   2. 结构版本（CACHE_SCHEMA_VERSION）不匹配自动丢弃——改动缓存字段时 +1 即可让旧缓存失效；
 *   3. 数据校验失败（空列表 / 缺字段 / 结构损坏）自动清除，避免把异常结果固化；
 *   4. 写入配额超限自动清空全部缓存后重试，仍失败则只保留内存缓存；
 *   5. 登出清空；登录时自动清理其它账号遗留的缓存。
 */

/** 缓存有效期 24 小时：缓存只负责首屏，进入页面后仍会后台刷新 */
const CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * 缓存结构版本：调整缓存字段（增删字段、改变剥离策略）时必须 +1。
 * 旧版本缓存会在读取时自动清除，避免「旧缓存 + 新代码」组合出运行时错误。
 */
export const CACHE_SCHEMA_VERSION = 2;

/** 单用户缓存写入上限（约 2MB），超出则不落盘，避免撑爆 localStorage */
const MAX_CACHE_SIZE = 2 * 1024 * 1024;

const KEY_PREFIX = "contacts_cache_";

interface ContactsCachePayload {
  v: number;
  ts: number;
  contacts: Contact[];
}

/** 数据校验：写入前 / 读取后都校验，异常数据一律不进入渲染 */
const isValidContacts = (contacts: unknown): contacts is Contact[] =>
  Array.isArray(contacts) &&
  contacts.length > 0 &&
  contacts.every(
    (item) =>
      !!item &&
      item.id !== undefined &&
      item.id !== null &&
      typeof item.name === "string" &&
      (item.messages === undefined || Array.isArray(item.messages)),
  );

/** 内存二级缓存：避免每次进入页面都重复 JSON.parse */
const memoryCache = new Map<string, ContactsCachePayload>();

const cacheKey = (userId: string) => `${KEY_PREFIX}${userId}`;

/**
 * 剥离大体量 / 必然过期的数据，只保留列表渲染需要的摘要字段。
 * messages / groupMembers / joinMessages 等由后台刷新或打开会话时按需拉取。
 */
const toCacheItem = (contact: Contact): Contact => {
  const {
    messages: _messages,
    groupMembers: _groupMembers,
    joinMessages: _joinMessages,
    joinNotices: _joinNotices,
    chatHistoryPagination: _pagination,
    ...rest
  } = contact;
  // messages 必须保留为空数组，不能剥成 undefined：
  // 下游（getChatHistory / markMessagesAsRead 等）普遍直接 contact.messages.map / push，
  // 缺字段会在切换会话时抛错，表现为「点一次之后就切不动了」。
  return { ...rest, messages: [] } as Contact;
};

/** 兜底补全必填字段：兼容旧版本缓存里没有 messages 的数据 */
const withDefaults = (contacts: Contact[]): Contact[] =>
  contacts.map((contact) => ({ ...contact, messages: contact.messages ?? [] }));

/** 写入缓存（同时更新内存二级缓存） */
export const saveContactsCache = (userId: string, contacts: Contact[]): void => {
  if (!userId || typeof window === "undefined") return;

  // 数据异常（空列表 / 缺字段）不写入，并清掉可能存在的旧缓存，避免继续展示错误数据
  if (!isValidContacts(contacts)) {
    clearContactsCache(userId);
    return;
  }

  const payload: ContactsCachePayload = {
    v: CACHE_SCHEMA_VERSION,
    ts: Date.now(),
    contacts: contacts.map(toCacheItem),
  };
  memoryCache.set(userId, payload);

  try {
    const raw = JSON.stringify(payload);
    // 体积超限只保留内存缓存，不落盘
    if (raw.length > MAX_CACHE_SIZE) return;
    localStorage.setItem(cacheKey(userId), raw);
  } catch {
    // 配额超限：自动清空全部缓存腾空间后重试一次，仍失败则只保留内存缓存
    clearContactsCache();
    try {
      const raw = JSON.stringify(payload);
      if (raw.length <= MAX_CACHE_SIZE) localStorage.setItem(cacheKey(userId), raw);
    } catch {
      /* 仍然失败则忽略，功能不受影响 */
    }
  }
};

/** 读取缓存：未命中、已过期、结构不兼容或数据损坏都自动清除并返回空数组 */
export const readContactsCache = (userId: string): Contact[] => {
  if (!userId) return [];

  const fromMemory = memoryCache.get(userId);
  if (fromMemory) {
    if (fromMemory.v !== CACHE_SCHEMA_VERSION || Date.now() - fromMemory.ts > CACHE_TTL) {
      clearContactsCache(userId);
      return [];
    }
    // 返回浅拷贝：避免响应式代理修改（如填充消息）污染内存缓存
    return withDefaults(fromMemory.contacts);
  }

  if (typeof window === "undefined") return [];

  try {
    const parsed = JSON.parse(
      localStorage.getItem(cacheKey(userId)) || "null",
    ) as ContactsCachePayload | null;

    // 版本不匹配（旧结构）或数据损坏 → 自动清除
    if (!parsed || parsed.v !== CACHE_SCHEMA_VERSION || !isValidContacts(parsed.contacts)) {
      clearContactsCache(userId);
      return [];
    }

    if (Date.now() - parsed.ts > CACHE_TTL) {
      clearContactsCache(userId);
      return [];
    }

    memoryCache.set(userId, parsed);
    // 返回浅拷贝：避免响应式代理修改（如填充消息）污染内存缓存
    return withDefaults(parsed.contacts);
  } catch {
    // 解析失败说明数据已损坏，直接清除
    clearContactsCache(userId);
    return [];
  }
};

/** 缓存写入时间戳：用于判断是否需要后台重新拉取 */
export const getContactsCacheMeta = (userId: string): { ts: number } | null => {
  const fromMemory = memoryCache.get(userId);
  if (fromMemory) return { ts: fromMemory.ts };
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ContactsCachePayload;
    return parsed?.ts ? { ts: parsed.ts } : null;
  } catch {
    return null;
  }
};

/** 清空缓存：传 userId 只清该用户，不传则清空全部用户的联系人缓存 */
export const clearContactsCache = (userId?: string): void => {
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

/**
 * 多窗口 / 多标签页自动同步：其它窗口写入本 key 时，自动丢弃本窗口的内存缓存，
 * 下次读取会重新解析 localStorage，避免两个窗口数据不一致。
 */
let storageBound = false;
const bindStorageSync = () => {
  if (storageBound || typeof window === "undefined") return;
  storageBound = true;

  window.addEventListener("storage", (event) => {
    if (!event.key) return; // storage.clear() 触发的事件，忽略

    if (event.key.startsWith(KEY_PREFIX)) {
      memoryCache.delete(event.key.slice(KEY_PREFIX.length));
    }
  });
};
bindStorageSync();

/** 登录成功后自动清理其它账号遗留的缓存（登录成功后调用）。
 * 换账号登录时旧账号数据不会再被读到，留着只会占用配额。
 */
export const pruneOtherUsersCache = (currentUserId: string): void => {
  if (!currentUserId) return;

  memoryCache.forEach((_, key) => {
    if (key !== currentUserId) memoryCache.delete(key);
  });

  if (typeof window === "undefined") return;

  try {
    const keepCache = cacheKey(currentUserId);
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith(KEY_PREFIX) && key !== keepCache) localStorage.removeItem(key);
    });
  } catch {
    /* 忽略 */
  }
};

/**
 * 主动清理所有已过期 / 结构不兼容的联系人缓存（应用启动或进入消息页时调用一次）。
 *
 * 缓存本身是「惰性清理」——读取时才发现过期。这已经能保证正确性，
 * 但过期数据会一直占着 localStorage 配额，直到该账号下次读取才会被清掉。
 * 这里做一次全量扫描，把不再需要的缓存提前释放，避免配额被长期占用。
 *
 * 注意：只清理「过期 / 版本不兼容 / 损坏」的缓存，
 * 当前账号仍有效的缓存会保留（否则会丢掉首屏秒开能力）。
 */
export const pruneExpiredContactsCache = (): void => {
  if (typeof window === "undefined") return;

  try {
    const now = Date.now();
    Object.keys(localStorage).forEach((key) => {
      if (!key.startsWith(KEY_PREFIX)) return;

      const userId = key.slice(KEY_PREFIX.length);
      let shouldRemove = false;

      try {
        const parsed = JSON.parse(localStorage.getItem(key) || "null") as
          | ContactsCachePayload
          | null;
        // 解析失败 / 版本不兼容 / 超过 TTL / 结构损坏 → 清理
        if (
          !parsed ||
          parsed.v !== CACHE_SCHEMA_VERSION ||
          !isValidContacts(parsed.contacts) ||
          now - parsed.ts > CACHE_TTL
        ) {
          shouldRemove = true;
        }
      } catch {
        // 数据损坏，直接清理
        shouldRemove = true;
      }

      if (shouldRemove) {
        memoryCache.delete(userId);
        localStorage.removeItem(key);
      }
    });
  } catch {
    /* 忽略：清理失败不影响功能 */
  }
};
