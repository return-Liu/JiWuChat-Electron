/**
 * 用 FFmpeg 把动态壁纸视频处理成「无缝循环」视频。
 *
 * 原理：正放 + 倒放拼接
 *  原视频正放完 → 倒放 → 循环
 *  因为倒放的首帧 = 正放的尾帧，画面完全连续，循环时无跳变。
 *
 * 用法：node scripts/make-seamless-loop.js
 */
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const themeDir = path.join(__dirname, "..", "public", "theme");

// 自动扫描所有 .mp4（排除已处理的 -loop 文件）
const videos = fs.readdirSync(themeDir).filter((f) => f.endsWith(".mp4") && !f.includes("-loop"));

for (const name of videos) {
  const input = path.join(themeDir, name);
  if (!fs.existsSync(input)) {
    console.log("跳过（不存在）:", name);
    continue;
  }

  const output = path.join(themeDir, name.replace(".mp4", "-loop.mp4"));
  console.log(`\n处理: ${name}`);

  // 正放 + 倒放拼接
  const filter = "[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[out]";

  try {
    console.log("  正在处理...");
    execFileSync(
      ffmpegPath,
      [
        "-y",
        "-i",
        input,
        "-filter_complex",
        filter,
        "-map",
        "[out]",
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "23",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        output,
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
    const sizeMB = (fs.statSync(output).size / 1024 / 1024).toFixed(2);
    console.log(`  完成: ${path.basename(output)} (${sizeMB} MB)`);
  } catch (err) {
    console.error("  处理失败:", (err.stderr || err.message || "").toString().slice(-400));
  }
}

console.log("\n全部完成");
