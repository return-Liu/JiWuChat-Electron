/**
 * 打包后清理脚本：整理 release 目录，只保留安装包和图标资源。
 *
 * 背景：
 * - electron-builder 打包后会生成大量中间产物：
 *   win-unpacked/、win-ia32-unpacked/（免安装目录，各约 280MB）、
 *   *.blockmap（增量更新索引）、builder-debug.yml、builder-effective-config.yaml、latest.yml。
 * - 正式分发只需要 NSIS 安装包（.exe），中间产物可安全删除。
 * - 同时将 build/icon 下的图标复制到 release/resources，方便单独取用。
 * - 每次升级版本号打包后，release 里会堆积历史版本的安装包（每个几百 MB），
 *   这里会自动删除版本号 ≠ package.json 当前版本的产物，只保留最新版本。
 *
 * 用法：node scripts/clean-release.js
 * 也可通过 `pnpm run electron:build:prod` 自动在打包后执行。
 */
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const releaseDir = path.join(rootDir, "release");
const iconSrcDir = path.join(rootDir, "build", "icon");

/** 当前版本号（来自 package.json），只有该版本的产物会被保留 */
const currentVersion = require("../package.json").version;

// 安装包后缀（win / mac / linux 全部产物类型）
const PACKAGE_EXTS = ["exe", "dmg", "zip", "pkg", "AppImage", "deb", "rpm", "snap", "apk", "tar.gz"];

/**
 * 从产物文件名中提取版本号。
 * 支持：JiwuChat_1.0.4_x64-setup.exe、JiwuChat_1.0.4-setup.exe、JiwuChat_1.0.4_arm64.dmg 等。
 * 无法识别一律返回 null（保守处理：不删）。
 */
function versionFromArtifact(name) {
  const escaped = PACKAGE_EXTS.map((e) => e.replace(".", "\\.")).join("|");
  const re = new RegExp(
    `_(\\d+\\.\\d+\\.\\d+)(?:_[0-9A-Za-z]+)?(?:-setup)?\\.(?:${escaped})$`,
    "i",
  );
  const m = name.match(re);
  return m ? m[1] : null;
}

// 需要删除的目录（相对 release）
const REMOVE_DIRS = [
  "win-unpacked",
  "win-ia32-unpacked",
  "win-arm64-unpacked",
  "mac",
  "linux-unpacked",
];

// 需要删除的文件（相对 release）
const REMOVE_FILES = ["builder-debug.yml", "builder-effective-config.yaml", "latest.yml"];

// 需要删除的文件通配后缀（相对 release）
const REMOVE_EXTENSIONS = [".blockmap"];

function main() {
  if (!fs.existsSync(releaseDir)) {
    console.log("[clean-release] release 目录不存在，跳过");
    return;
  }

  let freedBytes = 0;

  // 1. 删除解包目录
  for (const dir of REMOVE_DIRS) {
    const target = path.join(releaseDir, dir);
    if (!fs.existsSync(target)) continue;
    try {
      const size = dirSize(target);
      fs.rmSync(target, { recursive: true, force: true });
      freedBytes += size;
      console.log(`[clean-release] 已移除目录 ${dir} (${(size / 1024 / 1024).toFixed(2)} MB)`);
    } catch (err) {
      console.warn(`[clean-release] 移除目录 ${dir} 失败:`, err.message);
    }
  }

  // 2. 删除中间文件
  for (const file of REMOVE_FILES) {
    const target = path.join(releaseDir, file);
    if (!fs.existsSync(target)) continue;
    try {
      freedBytes += fs.statSync(target).size;
      fs.rmSync(target, { force: true });
      console.log(`[clean-release] 已移除文件 ${file}`);
    } catch (err) {
      console.warn(`[clean-release] 移除文件 ${file} 失败:`, err.message);
    }
  }

  // 3. 删除指定后缀的文件（如 .blockmap）
  for (const name of fs.readdirSync(releaseDir)) {
    if (!REMOVE_EXTENSIONS.some((ext) => name.endsWith(ext))) continue;
    const target = path.join(releaseDir, name);
    try {
      if (fs.statSync(target).isFile()) {
        freedBytes += fs.statSync(target).size;
        fs.rmSync(target, { force: true });
        console.log(`[clean-release] 已移除文件 ${name}`);
      }
    } catch (err) {
      console.warn(`[clean-release] 移除文件 ${name} 失败:`, err.message);
    }
  }

  // 4. 删除旧版本安装包（版本号 ≠ 当前 package.json 版本）
  let removedOld = 0;
  for (const name of fs.readdirSync(releaseDir)) {
    const target = path.join(releaseDir, name);
    let stat;
    try {
      stat = fs.lstatSync(target);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;

    const version = versionFromArtifact(name);
    if (!version || version === currentVersion) continue;

    try {
      fs.rmSync(target, { force: true });
      freedBytes += stat.size;
      removedOld += 1;
      console.log(
        `[clean-release] 已移除旧版本安装包 ${name} (v${version}，${(stat.size / 1024 / 1024).toFixed(2)} MB)`,
      );
    } catch (err) {
      console.warn(`[clean-release] 移除旧版本安装包 ${name} 失败:`, err.message);
    }
  }
  console.log(
    removedOld > 0
      ? `[clean-release] 已清理 ${removedOld} 个历史版本安装包，当前仅保留 v${currentVersion}`
      : `[clean-release] 未发现历史版本安装包，当前保留 v${currentVersion}`,
  );

  // 5. 复制图标资源到 release/resources（便于单独取用）
  if (fs.existsSync(iconSrcDir)) {
    const destDir = path.join(releaseDir, "resources");
    try {
      fs.cpSync(iconSrcDir, destDir, { recursive: true, force: true });
      console.log("[clean-release] 已复制图标资源到 release/resources");
    } catch (err) {
      console.warn("[clean-release] 复制图标资源失败:", err.message);
    }
  }

  if (freedBytes > 0) {
    console.log(`[clean-release] 共释放 ${(freedBytes / 1024 / 1024).toFixed(2)} MB`);
  }

  // 6. 打印最终结构
  console.log("\n[clean-release] 最终 release 结构：");
  printTree(releaseDir, "");
}

/** 递归计算目录大小（字节） */
function dirSize(dir) {
  let total = 0;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) total += dirSize(full);
    else if (entry.isFile()) total += fs.statSync(full).size;
  }
  return total;
}

/** 打印目录树（最多 2 层） */
function printTree(dir, prefix, depth = 0) {
  if (depth > 1) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      console.log(`${prefix}  ${entry.name}/`);
      printTree(full, prefix + "  ", depth + 1);
    } else {
      const mb = (fs.statSync(full).size / 1024 / 1024).toFixed(2);
      console.log(`${prefix}  ${entry.name}  (${mb} MB)`);
    }
  }
}

main();
