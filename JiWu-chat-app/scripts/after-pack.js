/**
 * electron-builder afterPack 钩子：
 * 1. 清理运行时中不必要的文件，减小体积。
 * 2. 修正 exe 的版本资源（CompanyName 等）。
 *
 * 背景：
 * - Electron 42 的 exe（Chromium 内核）约 220MB，无法压缩，是体积主要来源。
 * - 运行时目录中 `LICENSES.chromium.html`（约 19MB）仅为许可证声明文件，
 *   移除后不影响功能（已实测应用可正常启动）。
 * - 未配置代码签名证书时，electron-builder 不会改写 exe 的版本资源，
 *   导致「属性 → 详细信息」中的 CompanyName 显示 Electron 默认的 "GitHub, Inc."。
 *   这里用 rcedit 直接改写，使 CompanyName / 版权等字段显示为 JiWuChat。
 *
 * 注意：仅移除确认对功能无影响的文件，避免破坏图形/渲染能力。
 */
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

// 需要从打包产物中移除的文件（相对 appOutDir）
const REMOVE_FILES = [
  // Chromium 许可证声明文件（约 19MB），功能无关
  "LICENSES.chromium.html",
  // DirectX 着色器编译器（WebGPU 专用，约 25MB）。
  // 本项目未使用 WebGPU（已全局搜索确认无 navigator.gpu / requestAdapter 等调用），
  // 移除后不影响 WebGL / Canvas / 音视频等常规渲染能力。
  "dxcompiler.dll",
  "dxil.dll",
];

// 需要保留的语言包（其余语言包会被删除，减小体积）。
// package.json 已配置 electronLanguages: ["zh-CN"]，此处作为兜底确保只留中文。
const KEEP_LOCALES = ["zh-CN.pak"];

/**
 * 精简 locales 目录，只保留指定语言包。
 * @param {string} appOutDir 打包输出目录
 * @returns {number} 释放的字节数
 */
function pruneLocales(appOutDir) {
  const localesDir = path.join(appOutDir, "locales");
  if (!fs.existsSync(localesDir)) return 0;

  let freed = 0;
  for (const name of fs.readdirSync(localesDir)) {
    if (KEEP_LOCALES.includes(name)) continue;
    const target = path.join(localesDir, name);
    try {
      const st = fs.statSync(target);
      if (st.isFile()) {
        freed += st.size;
        fs.rmSync(target, { force: true });
      }
    } catch (err) {
      console.warn(`[afterPack] 移除语言包 ${name} 失败:`, err.message);
    }
  }
  return freed;
}

// 应用版本资源信息（写入 exe 属性 → 详细信息）
const VERSION_INFO = {
  CompanyName: "JiWuChat",
  LegalCopyright: "Copyright © 2026 JiWuChat",
};

/**
 * 定位 electron-builder 缓存中的 rcedit 可执行文件。
 * rcedit 随 winCodeSign 工具包一起下载，位于用户缓存目录。
 * @returns {string|null} rcedit 可执行文件路径，找不到返回 null
 */
function findRcedit() {
  const cacheRoot = path.join(
    process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || "", "AppData", "Local"),
    "electron-builder",
    "Cache",
    "winCodeSign",
  );
  if (!fs.existsSync(cacheRoot)) return null;

  // 缓存目录形如 winCodeSign-2.6.0/rcedit-x64.exe
  const candidates = [];
  for (const dir of fs.readdirSync(cacheRoot)) {
    const full = path.join(cacheRoot, dir);
    if (!fs.statSync(full).isDirectory()) continue;
    for (const name of ["rcedit-x64.exe", "rcedit-ia32.exe", "rcedit.exe"]) {
      const p = path.join(full, name);
      if (fs.existsSync(p)) candidates.push(p);
    }
  }
  return candidates[0] || null;
}

/**
 * 用 rcedit 改写 exe 的版本资源。
 * @param {string} appOutDir 打包输出目录
 * @param {string} productFilename 主程序 exe 文件名（如 "极物聊天.exe"）
 */
function patchExeVersionInfo(appOutDir, productFilename) {
  const exePath = path.join(appOutDir, productFilename);
  if (!fs.existsSync(exePath)) {
    console.warn(`[afterPack] 未找到主程序 exe：${exePath}`);
    return;
  }

  const rcedit = findRcedit();
  if (!rcedit) {
    console.warn("[afterPack] 未找到 rcedit，跳过版本信息修正");
    return;
  }

  const args = [exePath];
  for (const [key, value] of Object.entries(VERSION_INFO)) {
    args.push(`--set-version-string`, key, value);
  }

  try {
    execFileSync(rcedit, args, { stdio: "inherit" });
    console.log(`[afterPack] 已修正版本信息：${Object.keys(VERSION_INFO).join(", ")}`);
  } catch (err) {
    console.warn("[afterPack] 修正版本信息失败:", err.message);
  }
}

exports.default = async function afterPack(context) {
  const appOutDir = context.appOutDir;
  let removedBytes = 0;

  for (const rel of REMOVE_FILES) {
    const target = path.join(appOutDir, rel);
    try {
      if (fs.existsSync(target)) {
        removedBytes += fs.statSync(target).size;
        fs.rmSync(target, { force: true });
        console.log(`[afterPack] 已移除 ${rel}`);
      }
    } catch (err) {
      console.warn(`[afterPack] 移除 ${rel} 失败:`, err.message);
    }
  }

  if (removedBytes > 0) {
    console.log(`[afterPack] 共节省 ${(removedBytes / 1024 / 1024).toFixed(2)} MB`);
  }

  // 精简语言包（仅 Windows）：只保留中文，移除其他语言
  if (context.electronPlatformName === "win32") {
    const freedLocales = pruneLocales(appOutDir);
    if (freedLocales > 0) {
      console.log(`[afterPack] 精简语言包，节省 ${(freedLocales / 1024 / 1024).toFixed(2)} MB`);
    }
  }

  // 修正 exe 版本资源（仅 Windows）
  if (context.electronPlatformName === "win32") {
    const productFilename = `${context.packager.appInfo.productFilename}.exe`;
    patchExeVersionInfo(appOutDir, productFilename);
  }
};
