/**
 * 构建后处理脚本：将 Nuxt 的静态产物 .output/public 复制到 dist 目录。
 *
 * 背景：
 * - Nuxt 3 的 `nuxt generate` 默认输出到 `.output/public`
 * - 而 Electron 主进程（electron/main.js）与 electron-builder 配置均使用 `dist`
 * - 此前 `dist` 是指向 `.output/public` 的 Junction（目录联接），
 *   但 electron-builder 打包 asar 时不会跟随符号链接/Junction，
 *   导致打包产物中缺失 dist，生产环境加载 dist/index.html 失败而白屏。
 *
 * 因此改为：每次构建后把 .output/public 的真实内容复制到 dist 目录，
 * 确保 dist 是真实目录，能被 electron-builder 正确打包进 asar。
 *
 * 说明：Electron 生产环境通过自定义协议 app:// 加载页面（见 electron/main.js），
 * 资源使用根路径绝对路径（/），因此无需在此重写 HTML 中的资源路径。
 */
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const sourceDir = path.join(rootDir, ".output", "public");
const targetDir = path.join(rootDir, "dist");

function main() {
  if (!fs.existsSync(sourceDir)) {
    console.error(`[copy-dist] 源目录不存在：${sourceDir}`);
    console.error("[copy-dist] 请先执行 nuxt generate 生成静态产物。");
    process.exit(1);
  }

  // 清理旧的 dist（若是 Junction，先移除链接本身，避免误删目标内容）
  if (fs.existsSync(targetDir)) {
    const stat = fs.lstatSync(targetDir);
    if (stat.isSymbolicLink()) {
      // Junction / 符号链接：直接删除链接本身
      fs.unlinkSync(targetDir);
      console.log("[copy-dist] 已移除旧的 dist 链接（Junction/符号链接）");
    } else {
      fs.rmSync(targetDir, { recursive: true, force: true });
      console.log("[copy-dist] 已清理旧的 dist 目录");
    }
  }

  // 复制 .output/public -> dist（真实目录）
  fs.cpSync(sourceDir, targetDir, { recursive: true });
  console.log(`[copy-dist] 已复制 ${sourceDir} -> ${targetDir}`);
}

main();
