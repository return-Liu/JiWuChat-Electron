const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  screen,
  nativeImage,
  protocol,
  net,
  Tray,
  Menu,
} = require("electron");
const path = require("path");
const { pathToFileURL } = require("url");
const isDev = process.env.NODE_ENV === "development";
const fs = require("fs");
const { initWindowManager, openWindow } = require("./windowManager");

// ============= 应用身份标识（必须在创建任何窗口之前设置）=============
// Windows 任务栏图标 / 右键菜单（JumpList）依赖 AppUserModelID 与快捷方式匹配。
// 若设置过晚或缺失，任务栏会回退显示 electron.exe 的默认图标。
// 该 ID 必须与 electron-builder 的 build.appId 完全一致（com.jiwu.chat）。
app.setAppUserModelId("com.jiwu.chat");
// 设置应用名（影响部分系统 UI 显示，如任务管理器、通知）
app.setName("极物聊天");

// ============= 自定义协议（生产环境）=============
// Electron 通过 file:// 加载页面时，Vue Router 的 history 模式无法工作
// （file:// 下没有 origin，路径解析异常，导致 404 / 白屏）。
// 因此生产环境改用自定义协议 app://，把请求映射到 dist 目录，
// 使 history 路由能像在 http 服务器下一样正常工作。
const APP_SCHEME = "app";
const APP_ORIGIN = `${APP_SCHEME}://-`;

// 必须在 app ready 之前注册为特权协议，才能支持 fetch、CORS、Service Worker 等能力
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

/**
 * 注册 app:// 协议处理器：将请求路径映射到 dist 目录下的静态文件。
 * 例如 app://-/login -> <appPath>/dist/login/index.html（不存在则回退 index.html）
 */
function registerAppProtocol() {
  const distDir = path.join(app.getAppPath(), "dist");

  protocol.handle(APP_SCHEME, (request) => {
    const url = new URL(request.url);
    // url.pathname 形如 "/login" 或 "/_nuxt/xxx.js"
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === "/" || pathname === "") pathname = "/index.html";

    let filePath = path.join(distDir, pathname);

    // 目录 -> 尝试 index.html
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    // 文件不存在 -> 回退到 index.html（SPA fallback，交给前端路由处理）
    if (!fs.existsSync(filePath)) {
      filePath = path.join(distDir, "index.html");
    }

    return net.fetch(pathToFileURL(filePath).href);
  });
}

/**
 * 构建生产环境页面 URL（使用自定义协议，兼容 history 路由）。
 * @param {string} route 形如 "/login" 的路径
 */
function buildAppUrl(route) {
  const normalized = route.startsWith("/") ? route : `/${route}`;
  return `${APP_ORIGIN}${normalized}`;
}

// 开发环境下不在此处启用 electron-reload：
// 1. Nuxt dev server（npm run dev）已负责前端代码的 HMR 热更新；
// 2. nodemon --watch electron 已负责主进程（electron/*.js）变化时自动重启 Electron。
// 之前的 electron-reload + hardResetMethod:"exit" 会在任何文件变化时直接退出进程，
// 导致桌面窗口白屏/闪退，故移除。

let mainWindow = null;
// 存储所有辅助窗口
const auxiliaryWindows = new Map();
// 窗口预热池：提前创建好但不显示的窗口
const prewarmedWindows = new Map();
// 预热池窗口的创建时间戳，用于超时清理
const prewarmedTimestamps = new Map();
// 预热池窗口最大存活时间（5分钟），超时未使用则销毁
const PREWARM_TTL = 5 * 60 * 1000;
// 窗口创建中的 Promise，防止并发创建同一窗口
const pendingWindows = new Map();
// 最小窗口尺寸限制（相应调小）
const MIN_WINDOW_SIZE = {
  width: 380,
  height: 400,
};

// 窗口尺寸配置 - 根据不同页面设置不同尺寸（调小尺寸）
const WINDOW_SIZES = {
  login: { width: 400, height: 520 },
  register: { width: 400, height: 580 },
  "forgot-password": { width: 400, height: 540 },
  // 独立窗口页面（自定义标题栏 + 内容，与桌面 QQ 一致）
  settings: { width: 960, height: 680 },
  account: { width: 720, height: 560 },
  editgroup: { width: 720, height: 620 },
  addphone: { width: 480, height: 520 },
  deleteaccount: { width: 520, height: 560 },
  "login-devices": { width: 720, height: 560 },
  "notification-history": { width: 720, height: 600 },
  updateLogs: { width: 800, height: 640 },
  supercolorpalette: { width: 860, height: 640 },
  user: { width: 720, height: 560 },
  "chat-history": { width: 900, height: 680 },
  call: { width: 800, height: 600 },
  default: { width: 1200, height: 600 },
};

// 消息页面的最小尺寸限制（更大一些）
const MESSAGE_MIN_WINDOW_SIZE = {
  width: 1200,
  height: 600,
};

// ============= 图标设置函数 =============
// Windows 下优先使用 .ico（含多尺寸），任务栏/右键菜单/标题栏显示效果最佳；
// 其他平台回退到 .png。
function getIconPath() {
  let iconPath = null;

  if (isDev) {
    const possiblePaths = [
      path.join(__dirname, "..", "build", "icon", "logo.ico"),
      path.join(__dirname, "..", "build", "icon", "logo.png"),
      path.join(process.cwd(), "build", "icon", "logo.ico"),
      path.join(process.cwd(), "build", "icon", "logo.png"),
      path.join(__dirname, "..", "public", "logo.png"),
      path.join(process.cwd(), "public", "logo.png"),
      path.join(__dirname, "..", "public", "jiwuchat-elctron.png"),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        iconPath = p;
        break;
      }
    }
  } else {
    // 生产环境：extraResources 已将 build/icon 复制到 resources/icons
    const possiblePaths = [
      path.join(process.resourcesPath, "icons", "logo.ico"),
      path.join(process.resourcesPath, "icons", "logo.png"),
      path.join(process.resourcesPath, "app.asar", "build", "icon", "logo.ico"),
      path.join(process.resourcesPath, "app.asar", "public", "logo.png"),
      path.join(app.getAppPath(), "public", "logo.png"),
      path.join(process.resourcesPath, "app.asar", "public", "jiwuchat-elctron.png"),
    ];

    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        iconPath = p;
        break;
      }
    }
  }

  return iconPath;
}

function setAppIcon(window) {
  try {
    const iconPath = getIconPath();
    if (!iconPath || !fs.existsSync(iconPath)) {
      console.warn("Icon file not found:", iconPath);
      return false;
    }

    const icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      console.warn("Icon is empty or invalid format");
      return false;
    }

    if (window && !window.isDestroyed()) {
      window.setIcon(icon);
    }

    // AppUserModelID 已在模块顶层设置（创建窗口前），此处仅兜底确保生效
    if (process.platform === "win32") {
      app.setAppUserModelId("com.jiwu.chat");
    } else if (process.platform === "darwin") {
      app.dock.setIcon(icon);
    }

    console.log("Icon set successfully");
    return true;
  } catch (error) {
    console.error("Failed to set icon:", error);
    return false;
  }
}

// ============= 系统托盘 =============
let tray = null;
// 标记是否真正退出应用（区分「关闭窗口」与「退出程序」）
let isQuitting = false;

/**
 * 获取托盘图标（优先使用 .ico / 小尺寸 png）。
 * 托盘图标建议使用 16x16 / 32x32 的小图，避免过大显示异常。
 */
function getTrayIcon() {
  const candidates = isDev
    ? [
        path.join(__dirname, "..", "build", "icon", "logo.ico"),
        path.join(__dirname, "..", "build", "icon", "logo.png"),
        path.join(process.cwd(), "build", "icon", "logo.ico"),
        path.join(process.cwd(), "build", "icon", "logo.png"),
        path.join(__dirname, "..", "public", "logo.png"),
      ]
    : [
        path.join(process.resourcesPath, "icons", "logo.ico"),
        path.join(process.resourcesPath, "icons", "logo.png"),
        path.join(process.resourcesPath, "app.asar", "build", "icon", "logo.ico"),
        path.join(process.resourcesPath, "app.asar", "public", "logo.png"),
      ];

  for (const p of candidates) {
    if (fs.existsSync(p)) {
      const img = nativeImage.createFromPath(p);
      if (!img.isEmpty()) {
        // Windows 托盘建议使用 16x16，避免图标过大
        return process.platform === "win32" ? img.resize({ width: 16, height: 16 }) : img;
      }
    }
  }
  return null;
}

/**
 * 显示并聚焦主窗口（若已最小化则还原，若已隐藏则显示）。
 */
function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

/**
 * 切换主窗口显示/隐藏（点击托盘图标时调用）。
 */
function toggleMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
    return;
  }
  if (mainWindow.isVisible() && !mainWindow.isMinimized()) {
    mainWindow.hide();
  } else {
    showMainWindow();
  }
}

/**
 * 创建系统托盘图标与菜单。
 */
function createTray() {
  if (tray) return;

  const icon = getTrayIcon();
  if (!icon) {
    console.warn("[托盘] 未找到可用的托盘图标，跳过托盘创建");
    return;
  }

  tray = new Tray(icon);
  tray.setToolTip("极物聊天");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "重载",
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.reload();
        }
      },
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  // 点击托盘图标：切换主窗口显示/隐藏（Windows/Linux）
  tray.on("click", () => toggleMainWindow());

  console.log("[托盘] 系统托盘已创建");
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const windowWidth = WINDOW_SIZES.login.width;
  const windowHeight = WINDOW_SIZES.login.height;
  const x = Math.round((screenWidth - windowWidth) / 2);
  const y = Math.round((screenHeight - windowHeight) / 2);

  mainWindow = new BrowserWindow({
    x: x,
    y: y,
    width: windowWidth,
    height: windowHeight,
    minWidth: MIN_WINDOW_SIZE.width,
    minHeight: MIN_WINDOW_SIZE.height,
    resizable: true,
    frame: false,
    show: false,
    autoHideMenuBar: true,
    roundedCorners: true,
    icon: getIconPath() || undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      zoomFactor: 1.0,
    },
  });

  setAppIcon(mainWindow);

  if (isDev) {
    mainWindow.loadURL("http://localhost:3000/login");
    mainWindow.webContents.openDevTools();
  } else {
    // 生产环境使用自定义协议 app://，兼容 history 路由（file:// 下会 404/白屏）
    mainWindow.loadURL(buildAppUrl("/login"));
  }

  // 监听主窗口最大化/还原事件，通知渲染进程
  mainWindow.on("maximize", () => {
    mainWindow.webContents.send("window-maximize-state-change", true);
  });
  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send("window-maximize-state-change", false);
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  // 点击关闭按钮时：隐藏到托盘（而非退出应用）。
  // 仅当用户从托盘菜单选择「退出极物聊天」时（isQuitting=true）才真正关闭。
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("before-input-event", (event, input) => {
    if (input.control && (input.key === "=" || input.key === "+")) {
      event.preventDefault();
      return;
    } else if (input.control && input.key === "-") {
      event.preventDefault();
      return;
    } else if (input.control && input.key === "0") {
      event.preventDefault();
      mainWindow.webContents.setZoomFactor(1.0);
    }
  });
}

// 辅助函数：获取窗口的最小尺寸
function getMinWindowSize(pageName) {
  if (pageName === "login" || pageName === "register" || pageName === "forgot-password") {
    return MIN_WINDOW_SIZE;
  }
  return MESSAGE_MIN_WINDOW_SIZE;
}

// 辅助函数：调整窗口大小并保持最大化状态
function adjustWindowSize(window, pageName) {
  if (!window || window.isDestroyed()) return;

  const size = WINDOW_SIZES[pageName] || WINDOW_SIZES.default;

  // 检查当前窗口是否最大化
  const isMaximized = window.isMaximized();

  // 如果窗口已最大化，保持最大化状态，只调整最小尺寸限制
  if (isMaximized) {
    const minSize = getMinWindowSize(pageName);
    window.setMinimumSize(minSize.width, minSize.height);

    if (pageName === "message") {
      window.setMaximizable(true);
    }

    // 通知渲染进程窗口状态
    window.webContents.send("window-state-changed", "maximized");
    return;
  }

  // 如果窗口未最大化，正常调整大小并居中
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const newX = Math.round((screenWidth - size.width) / 2);
  const newY = Math.round((screenHeight - size.height) / 2);

  window.setSize(size.width, size.height);
  window.setPosition(newX, newY);

  const minSize = getMinWindowSize(pageName);
  window.setMinimumSize(minSize.width, minSize.height);

  if (pageName === "message") {
    window.setMaximizable(true);
  }
}

// IPC 事件处理 - 窗口控制（支持主窗口和辅助窗口）
ipcMain.on("minimize-window", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.minimize();
  }
});

ipcMain.on("maximize-window", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on("close-window", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    win.close();
  }
});

// IPC 事件处理 - 窗口尺寸调整（支持主窗口和辅助窗口）
ipcMain.on("resize-window", (event, pageName) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && !win.isDestroyed()) {
    adjustWindowSize(win, pageName);
  }
});

// 监听窗口状态变化并通知渲染进程
ipcMain.handle("get-window-state", () => {
  if (!mainWindow) return "closed";
  if (mainWindow.isMaximized()) return "maximized";
  if (mainWindow.isMinimized()) return "minimized";
  return "normal";
});

// IPC 事件处理 - 获取窗口最大化状态
ipcMain.handle("get-window-maximize-state", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return false;
  return win.isMaximized();
});

// IPC 事件处理 - 获取应用版本号
ipcMain.handle("get-app-version", () => {
  return app.getVersion();
});

// ============= 窗口预热池 =============
// 所有可能作为独立窗口打开的页面（除了主窗口页面）
// 只预热最高频的少数页面，避免启动时同时渲染多个完整 Nuxt 页面导致卡顿
const PREWARM_PAGES = ["settings", "account"];
// 预热页面的默认完整路径（关键：settings 是动态路由 /settings/:tab，
// 直接加载 /settings 会 404，必须加载一个有效的默认 tab）
const PREWARM_DEFAULT_PATHS = {
  settings: "/settings/notification",
  account: "/account",
};
// 可选预热的低频页面（仅当真正需要时才按需创建，不参与启动预热）
const OPTIONAL_PREWARM_PAGES = [
  "addphone",
  "deleteaccount",
  "login-devices",
  "notification-history",
  "updateLogs",
  "supercolorpalette",
];

// 预热池状态
const prewarmQueue = [...PREWARM_PAGES];
let isPrewarming = false;

/**
 * 逐个预热窗口（避免同时创建多个窗口导致卡顿）
 * 串行创建 + 较长间隔，避免启动阶段 CPU 峰值影响主窗口交互
 */
async function prewarmWindows() {
  if (isPrewarming) return;
  isPrewarming = true;

  for (const pageName of prewarmQueue) {
    // 如果已有可见窗口或预热窗口，跳过
    if (auxiliaryWindows.has(pageName) || prewarmedWindows.has(pageName)) {
      continue;
    }

    try {
      await createHiddenWindow(pageName);
      // 每个窗口预热间隔 1200ms，充分降低 CPU 峰值
      await new Promise((resolve) => setTimeout(resolve, 1200));
    } catch (err) {
      console.error(`预热窗口 ${pageName} 失败:`, err);
    }
  }

  isPrewarming = false;
}

/**
 * 创建隐藏的预热窗口
 */
function createHiddenWindow(pageName) {
  return new Promise((resolve, reject) => {
    if (prewarmedWindows.has(pageName)) {
      resolve();
      return;
    }

    const size = WINDOW_SIZES[pageName] || WINDOW_SIZES.default;
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
    const x = Math.round((screenWidth - size.width) / 2);
    const y = Math.round((screenHeight - size.height) / 2);

    const win = new BrowserWindow({
      x,
      y,
      width: size.width,
      height: size.height,
      minWidth: MIN_WINDOW_SIZE.width,
      minHeight: MIN_WINDOW_SIZE.height,
      resizable: true,
      frame: false,
      show: false,
      autoHideMenuBar: true,
      roundedCorners: true,
      icon: getIconPath() || undefined,
      // 关键：背景色与 AuxiliaryWindowLoader 组件背景一致，消除白屏闪烁
      backgroundColor: "#f5f7fa",
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
        zoomFactor: 1.0,
        // 禁用后台节流，让预热窗口正常加载
        backgroundThrottling: false,
      },
    });

    setAppIcon(win);
    win.auxiliaryPageName = pageName;
    // 预热窗口加载默认完整路径（而非基础路径），避免动态路由（如 /settings）404
    const prewarmPath = PREWARM_DEFAULT_PATHS[pageName] || `/${pageName}`;
    win.auxiliaryFullPath = prewarmPath;

    // 使用统一 URL 构建函数
    const url = buildWindowUrl(prewarmPath);

    // 设置加载超时（15秒），避免预热窗口永久挂起
    const loadTimeout = setTimeout(() => {
      console.warn(`预热窗口 ${pageName} 加载超时`);
      if (!win._isReady) {
        win._isReady = true;
        resolve();
      }
    }, 15000);

    // ready-to-show 后标记就绪
    win.once("ready-to-show", () => {
      clearTimeout(loadTimeout);
      win._isReady = true;
      resolve();
    });

    // 加载失败也 resolve，避免阻塞预热队列
    win.webContents.on("did-fail-load", () => {
      clearTimeout(loadTimeout);
      if (!win._isReady) {
        win._isReady = true;
        resolve();
      }
    });

    setupWindowEvents(win, pageName);
    prewarmedWindows.set(pageName, win);
    prewarmedTimestamps.set(pageName, Date.now());

    win.loadURL(url).catch((err) => {
      clearTimeout(loadTimeout);
      console.error(`预加载窗口 ${pageName} 失败:`, err);
      reject(err);
    });
  });
}

/**
 * 补充预热池（窗口关闭后调用）
 * 增强防护：多重检查防止创建重复的预热窗口
 * 仅补充高频页面，且延迟较长，避免关闭窗口后立即重建导致卡顿
 */
function refillPrewarm(pageName) {
  if (!PREWARM_PAGES.includes(pageName)) return;
  // 延迟补充，避免窗口关闭动画期间创建新窗口
  setTimeout(() => {
    // 多重检查：确保不会重复创建预热窗口
    if (
      prewarmedWindows.has(pageName) ||
      auxiliaryWindows.has(pageName) ||
      pendingWindows.has(pageName)
    ) {
      return;
    }
    createHiddenWindow(pageName).catch((err) => {
      console.error(`补充预热窗口 ${pageName} 失败:`, err);
    });
  }, 3000);
}

// 提取窗口事件绑定为公共函数
function setupWindowEvents(win, pageName) {
  win.on("maximize", () => {
    win.webContents.send("window-maximize-state-change", true);
  });
  win.on("unmaximize", () => {
    win.webContents.send("window-maximize-state-change", false);
  });
  win.on("closed", () => {
    auxiliaryWindows.delete(pageName);
    prewarmedWindows.delete(pageName);
    prewarmedTimestamps.delete(pageName);
    pendingWindows.delete(pageName);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("auxiliary-window-closed", pageName);
    }
    // 自动补充预热池
    refillPrewarm(pageName);
  });
}

/**
 * 将窗口标记为"已使用"（从预热池取出后调用）
 * 先移除旧的 closed 监听器，再重新绑定，防止预热池的 closed 事件和可见窗口的 closed 事件重复触发
 */
function markWindowAsActive(win, pageName) {
  // 移除所有 closed 监听器（预热池阶段绑定的）
  win.removeAllListeners("closed");
  // 重新绑定完整的事件处理
  setupWindowEvents(win, pageName);
  // 立即加入可见窗口集合，防止并发请求创建重复窗口
  auxiliaryWindows.set(pageName, win);
}

// 根据完整路径构建加载 URL
function buildWindowUrl(fullPath) {
  // 规范化：确保以 / 开头
  const normalizedPath = fullPath.startsWith("/") ? fullPath : `/${fullPath}`;
  if (isDev) {
    return `http://localhost:3000${normalizedPath}`;
  } else {
    // 生产环境使用自定义协议，兼容 history 路由
    return buildAppUrl(normalizedPath);
  }
}

/**
 * 窗口内 SPA 路由跳转（关键性能优化）
 * 窗口的 Nuxt 应用已就绪时，通过 IPC 通知渲染进程执行 router.push，
 * 而不是 loadURL 重新加载整个页面，避免二次完整渲染导致卡顿。
 * @param {BrowserWindow} win 目标窗口
 * @param {string} fullPath 目标路径（含子路径和 query）
 */
function navigateWindow(win, fullPath) {
  if (!win || win.isDestroyed()) return;
  const normalizedPath = fullPath.startsWith("/") ? fullPath : `/${fullPath}`;
  // 记录最新路径，供后续去重判断
  win.auxiliaryFullPath = normalizedPath;
  // 通知渲染进程执行 SPA 跳转
  win.webContents.send("navigate", normalizedPath);
}

// IPC 事件处理 - 打开新窗口（优化版：预热池 + 即时显示）
ipcMain.handle("open-auxiliary-window", async (event, pageName) => {
  // 完整路径：用于加载正确路由（含子路径和 query）
  const fullPath = (pageName || "").startsWith("/") ? pageName : `/${pageName || ""}`;
  // 窗口标识：仅用第一段路径（去掉 query），用于窗口去重/聚焦/预热池
  const normalizedPageName = fullPath.replace(/^\//, "").split("?")[0].split("/")[0];

  // 1. 检查是否已有可见窗口 → 直接聚焦
  if (auxiliaryWindows.has(normalizedPageName)) {
    const existingWindow = auxiliaryWindows.get(normalizedPageName);
    if (existingWindow && !existingWindow.isDestroyed()) {
      if (existingWindow.isMinimized()) {
        existingWindow.restore();
      }

      // 若已有窗口但路径不同（如 /editgroup/123 与 /editgroup/456），导航到新路径
      // 关键优化：使用窗口内 SPA 跳转，避免 loadURL 二次完整加载
      const existingPath = existingWindow.auxiliaryFullPath || "";
      if (existingPath && existingPath !== fullPath) {
        navigateWindow(existingWindow, fullPath);
      }

      existingWindow.focus();
      return { success: true, action: "focused" };
    } else {
      auxiliaryWindows.delete(normalizedPageName);
    }
  }

  // 2. 防止并发创建
  if (pendingWindows.has(normalizedPageName)) {
    return pendingWindows.get(normalizedPageName);
  }

  const createPromise = (async () => {
    try {
      let win;
      let fromPrewarm = false;

      // 3. 优先使用预热池中的窗口（已加载完成，直接显示）
      // 注意：预热池窗口加载的是第一段路径，若当前请求带子路径，需重新导航
      if (prewarmedWindows.has(normalizedPageName)) {
        win = prewarmedWindows.get(normalizedPageName);
        prewarmedWindows.delete(normalizedPageName);
        prewarmedTimestamps.delete(normalizedPageName);

        if (win && !win.isDestroyed()) {
          fromPrewarm = true;
          // 记录完整路径（预热窗口加载的是基础路径，需导航到完整路径）
          win.auxiliaryFullPath = fullPath;
          // 关键：立即标记为活跃窗口，防止并发请求创建重复窗口
          markWindowAsActive(win, normalizedPageName);
        } else {
          win = null;
        }
      }

      // 4. 预热池没有 → 创建新窗口
      if (!win) {
        const size = WINDOW_SIZES[normalizedPageName] || WINDOW_SIZES.default;
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
        const x = Math.round((screenWidth - size.width) / 2);
        const y = Math.round((screenHeight - size.height) / 2);

        win = new BrowserWindow({
          x,
          y,
          width: size.width,
          height: size.height,
          minWidth: MIN_WINDOW_SIZE.width,
          minHeight: MIN_WINDOW_SIZE.height,
          resizable: true,
          frame: false,
          show: false,
          autoHideMenuBar: true,
          roundedCorners: true,
          icon: getIconPath() || undefined,
          // 关键：背景色与 AuxiliaryWindowLoader 一致，消除白屏
          backgroundColor: "#f5f7fa",
          webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, "preload.js"),
            zoomFactor: 1.0,
            backgroundThrottling: false,
          },
        });

        setAppIcon(win);
        win.auxiliaryPageName = normalizedPageName;
        win.auxiliaryFullPath = fullPath;

        setupWindowEvents(win, normalizedPageName);

        // 加载页面（使用完整路径）
        win.loadURL(buildWindowUrl(fullPath)).catch((err) => {
          console.error("Failed to load URL:", err);
        });
      }

      // 5. 等待窗口就绪后显示（预热池窗口已就绪，跳过等待）
      if (!fromPrewarm || !win._isReady) {
        if (!win._isReady) {
          await new Promise((resolve) => {
            const checkReady = () => {
              if (win._isReady || win.isDestroyed()) {
                resolve();
              } else {
                win.once("ready-to-show", () => {
                  win._isReady = true;
                  resolve();
                });
              }
            };
            checkReady();
          });
        }
      }

      // 6. 显示窗口
      if (win && !win.isDestroyed()) {
        // 预热池窗口加载的是基础路径，若请求带子路径/query，导航到完整路径
        // 关键优化：使用窗口内 SPA 跳转（router.push），避免 loadURL 二次完整渲染
        if (fromPrewarm && win.auxiliaryFullPath && win.auxiliaryFullPath !== fullPath) {
          navigateWindow(win, fullPath);
        }
        // 如果是按需创建的窗口（非预热池），此时才加入 auxiliaryWindows
        if (!fromPrewarm) {
          auxiliaryWindows.set(normalizedPageName, win);
        }
        win.show();
        // 短暂延迟后聚焦，避免闪烁
        setTimeout(() => {
          if (win && !win.isDestroyed()) {
            win.focus();
          }
        }, 30);
      }

      // 7. 异步补充预热池
      refillPrewarm(normalizedPageName);

      return { success: true, action: fromPrewarm ? "focused" : "created" };
    } catch (error) {
      console.error(`创建辅助窗口失败: ${normalizedPageName}`, error);
      return { success: false, action: "created", error: error.message };
    } finally {
      pendingWindows.delete(normalizedPageName);
    }
  })();

  pendingWindows.set(normalizedPageName, createPromise);
  return createPromise;
});

// 添加辅助窗口的尺寸调整支持
ipcMain.on("resize-auxiliary-window", (event, pageName) => {
  const normalizedPageName = pageName.replace(/^\//, "").split("/")[0];
  if (auxiliaryWindows.has(normalizedPageName)) {
    const auxWindow = auxiliaryWindows.get(normalizedPageName);
    if (auxWindow && !auxWindow.isDestroyed()) {
      adjustWindowSize(auxWindow, normalizedPageName);
    }
  }
});

// 获取当前窗口是否为辅助窗口（供渲染进程判断）
ipcMain.handle("is-auxiliary-window", (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return false;
  // 辅助窗口有 auxiliaryPageName 属性，主窗口没有
  return !!win.auxiliaryPageName;
});

// ============= UI 设置跨窗口同步（字体大小/字体族）=============
// 设置窗口（独立窗口）修改字体后，通过此 IPC 广播给主窗口，
// 主窗口监听到后重新 applyToCSS，使字体设置在所有窗口即时生效。
ipcMain.on("broadcast-ui-settings", (event, settings) => {
  const sender = BrowserWindow.fromWebContents(event.sender);
  // 广播给除发送者外的所有窗口（主窗口 + 其它辅助窗口）
  const allWindows = BrowserWindow.getAllWindows();
  for (const win of allWindows) {
    if (win === sender || win.isDestroyed()) continue;
    win.webContents.send("ui-settings-changed", settings);
  }
});

// ============= 主题跨窗口同步（明暗模式/侧边栏颜色）=============
// 设置窗口修改主题后，广播给所有其它窗口，使其立即应用新主题。
ipcMain.on("broadcast-theme-settings", (event, settings) => {
  const sender = BrowserWindow.fromWebContents(event.sender);
  const allWindows = BrowserWindow.getAllWindows();
  for (const win of allWindows) {
    if (win === sender || win.isDestroyed()) continue;
    win.webContents.send("theme-settings-changed", settings);
  }
});

// ============= OAuth 第三方登录窗口 =============
let oauthWindow = null;

ipcMain.handle("open-oauth-window", async (event, authUrl) => {
  // 如果已有 OAuth 窗口，先关闭
  if (oauthWindow && !oauthWindow.isDestroyed()) {
    oauthWindow.close();
    oauthWindow = null;
  }

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const windowWidth = 800;
  const windowHeight = 650;
  const x = Math.round((screenWidth - windowWidth) / 2);
  const y = Math.round((screenHeight - windowHeight) / 2);

  oauthWindow = new BrowserWindow({
    x: x,
    y: y,
    width: windowWidth,
    height: windowHeight,
    minWidth: 600,
    minHeight: 500,
    resizable: true,
    frame: true, // OAuth 窗口使用系统标题栏（需要显示 URL 地址栏安全感）
    show: true,
    autoHideMenuBar: true,
    backgroundColor: "#ffffff",
    icon: getIconPath() || undefined,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
      zoomFactor: 1.0,
    },
  });

  setAppIcon(oauthWindow);

  // 加载 OAuth 授权 URL
  oauthWindow.loadURL(authUrl).catch((err) => {
    console.error("Failed to load OAuth URL:", err);
  });

  // 监听 URL 变化，检测回调
  oauthWindow.webContents.on("will-redirect", (event, url) => {
    handleOAuthCallback(url);
  });

  oauthWindow.webContents.on("will-navigate", (event, url) => {
    handleOAuthCallback(url);
  });

  // 监听窗口关闭
  oauthWindow.on("closed", () => {
    oauthWindow = null;
    // 通知渲染进程 OAuth 窗口已关闭
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("oauth-window-closed");
    }
  });

  return { success: true };
});

// 处理 OAuth 回调 URL
function handleOAuthCallback(url) {
  // 检测是否是回调 URL（包含 token 参数）
  if (!url) return;

  const parsedUrl = new URL(url);
  const token = parsedUrl.searchParams.get("token");
  const user = parsedUrl.searchParams.get("user");
  const error = parsedUrl.searchParams.get("error");

  if (token || error) {
    // 关闭 OAuth 窗口
    if (oauthWindow && !oauthWindow.isDestroyed()) {
      oauthWindow.close();
      oauthWindow = null;
    }

    // 将回调数据发送给主窗口
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("oauth-callback", {
        token: token || null,
        user: user || null,
        error: error || null,
        url: url,
      });
    }
  }
}

app.whenReady().then(() => {
  // 生产环境注册自定义协议处理器（映射到 dist 目录）
  if (!isDev) {
    registerAppProtocol();
  }

  // 初始化统一窗口管理器（注册 app-open-window 等 IPC）
  initWindowManager({ ipcMain });

  // 创建系统托盘
  createTray();

  createWindow();

  // 预热常用辅助窗口（延迟 1 秒，等主窗口先加载完成）
  setTimeout(() => {
    prewarmWindows();
  }, 1000);

  // 预热池超时清理：每 60 秒检查一次，销毁超过 TTL 未使用的预热窗口
  setInterval(() => {
    const now = Date.now();
    for (const [pageName, timestamp] of prewarmedTimestamps.entries()) {
      if (now - timestamp > PREWARM_TTL) {
        const win = prewarmedWindows.get(pageName);
        if (win && !win.isDestroyed()) {
          win.close();
        }
        prewarmedWindows.delete(pageName);
        prewarmedTimestamps.delete(pageName);
        console.log(`[预热池] 超时清理: ${pageName}`);
      }
    }
  }, 60000);

  // 打开 Web 体验窗口（固定宽高，加载前端界面）
  ipcMain.handle("open-web-experience", () => {
    const experienceWin = new BrowserWindow({
      width: 1200,
      height: 750,
      resizable: true,
      minimizable: true,
      maximizable: true,
      frame: false,
      autoHideMenuBar: true,
      roundedCorners: true,
      backgroundColor: "#f5f7fa",
      icon: getIconPath() || undefined,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    setAppIcon(experienceWin);

    if (isDev) {
      experienceWin.loadURL("http://localhost:3000/login");
    } else {
      experienceWin.loadURL(buildAppUrl("/login"));
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 用户从系统/任务管理器请求退出时，标记为真正退出
app.on("before-quit", () => {
  isQuitting = true;
});

app.on("window-all-closed", () => {
  // 有托盘时常驻后台：仅当用户明确退出（isQuitting）时才退出应用。
  // macOS 上按平台惯例常驻，不退出。
  if (isQuitting && process.platform !== "darwin") {
    app.quit();
  }
});

// 应用退出前销毁托盘，避免残留图标
app.on("will-quit", () => {
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
    tray = null;
  }
});
