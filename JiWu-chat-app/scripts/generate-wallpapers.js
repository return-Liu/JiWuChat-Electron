/**
 * 个性装扮壁纸自动化脚本
 *
 * 功能：
 *  1. 扫描 public/theme 下的所有视频（.mp4）和图片（.png/.jpg/.jpeg/.webp）
 *  2. 为视频生成「无缝循环」版本（正放 + 倒放拼接），输出 xxx-loop.mp4
 *  3. 为视频抽取首帧作为卡片封面，输出 public/theme/posters/xxx.jpg
 *  4. 自动生成 stores/dynamicWallpapers.generated.ts，供 store 引入
 *
 * 用法：node scripts/generate-wallpapers.js
 * 之后只需往 public/theme 放视频/图片，重新运行本脚本即可。
 *
 * 封面作用：设置页卡片默认只显示这张小图（几十 KB），只有悬停时才真正加载
 * 视频本体（可能数 MB），避免一次性发起十几个视频请求。
 */
const { execFileSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const themeDir = path.join(__dirname, "..", "public", "theme");
const postersDir = path.join(themeDir, "posters");
const outTsFile = path.join(__dirname, "..", "stores", "dynamicWallpapers.generated.ts");

const VIDEO_EXT = [".mp4"];
const IMAGE_EXT = [".png", ".jpg", ".jpeg", ".webp"];

/** 从文件名提取简洁的壁纸名称（去掉「哲风壁纸」等后缀） */
function extractName(filename) {
  let name = filename.replace(/\.(mp4|png|jpg|jpeg|webp)$/i, "");
  // 去掉 -loop 后缀
  name = name.replace(/-loop$/i, "");
  // 去掉「...」括号内容
  name = name.replace(/「[^」]*」/g, "");
  // 去掉常见后缀
  name = name
    .replace(/哲风壁纸/g, "")
    .replace(/动态壁纸/g, "")
    .replace(/背景视频|背景/g, "");
  // 去掉分隔符
  name = name
    .replace(/[｜|\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return name || filename;
}

/**
 * 读取已生成的 dynamicWallpapers.generated.ts 中已有的 name（按 url 映射）。
 * 重新生成时优先复用已人工翻译好的中文名称，避免被 extractName 覆盖回英文。
 */
function readExistingNames() {
  try {
    const content = fs.readFileSync(outTsFile, "utf8");
    const map = {};
    const re = /"name":\s*"([^"]*)",\s*"type":\s*"[^"]*",\s*"url":\s*"([^"]*)"/g;
    let m;
    while ((m = re.exec(content)) !== null) {
      map[m[2]] = m[1];
    }
    return map;
  } catch {
    return {};
  }
}

/** 获取文件修改时间 */
function mtime(file) {
  try {
    return fs.statSync(file).mtimeMs;
  } catch {
    return 0;
  }
}

/**
 * 生成无缝循环视频（正放 + 倒放拼接）
 *
 * 性能说明：reverse 滤镜必须把整段视频的每一帧全部解码并缓存进内存才能倒着输出，
 * 4K / 长视频会非常慢且极占内存。因此这里先做两件事把规模压下来：
 *   1) trim：只取前 maxSeconds 秒（0 表示不裁剪）
 *   2) scale：把宽度限制到 maxWidth（不会放大比源更小的视频）
 * 之后再用更快的 x264 预设编码，整体通常能快 5~10 倍。
 *
 * 体积优化（壁纸作为背景使用，无需高码率）：
 *   - 默认宽度 1280（720p 级别，背景足够清晰）
 *   - 默认帧率上限 30fps（壁纸无需 60fps，可省约一半体积）
 *   - 默认 CRF 26（视觉几乎无感，体积显著下降）
 *
 * 可用环境变量覆盖：
 *   WALLPAPER_MAX_WIDTH=1280   输出最大宽度
 *   WALLPAPER_MAX_SECONDS=15   参与循环的最长时长（秒），0 = 不裁剪
 *   WALLPAPER_FPS=30           输出帧率上限（0 = 保持源帧率）
 *   WALLPAPER_CRF=26           质量（越大体积越小，18~28 合理）
 *   WALLPAPER_PRESET=medium    x264 预设
 */
function makeSeamlessLoop(input, output) {
  const maxWidth = Number(process.env.WALLPAPER_MAX_WIDTH || 1280);
  const maxSeconds = Number(process.env.WALLPAPER_MAX_SECONDS || 15);
  const fps = Number(process.env.WALLPAPER_FPS || 30);
  const crf = String(process.env.WALLPAPER_CRF || 26);
  const preset = process.env.WALLPAPER_PRESET || "medium";

  const head = maxSeconds > 0 ? `trim=start=0:end=${maxSeconds},setpts=PTS-STARTPTS,` : "";
  const fpsFilter = fps > 0 ? `fps=${fps},` : "";
  const filter =
    `[0:v]${head}scale='min(${maxWidth},iw)':-2:flags=bicubic,${fpsFilter}` +
    `split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[out]`;

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
      preset,
      "-crf",
      crf,
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      output,
    ],
    // stderr 直接继承，让 ffmpeg 的 frame/fps/speed 进度实时显示，避免看起来像卡死
    { stdio: ["ignore", "ignore", "inherit"] },
  );
}

/**
 * 重压缩已有 -loop.mp4（无需源视频）。
 * 用于对历史生成的超大壁纸做体积瘦身，保持相同文件名与循环特性。
 * 参数与 makeSeamlessLoop 保持一致，但不做 reverse 拼接（已是循环成品）。
 */
function recompressLoop(input, output) {
  const maxWidth = Number(process.env.WALLPAPER_MAX_WIDTH || 1280);
  const fps = Number(process.env.WALLPAPER_FPS || 30);
  const crf = String(process.env.WALLPAPER_CRF || 26);
  const preset = process.env.WALLPAPER_PRESET || "medium";

  const fpsFilter = fps > 0 ? `,fps=${fps}` : "";
  const filter = `scale='min(${maxWidth},iw)':-2:flags=bicubic${fpsFilter}`;

  execFileSync(
    ffmpegPath,
    [
      "-y",
      "-i",
      input,
      "-vf",
      filter,
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      preset,
      "-crf",
      crf,
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      output,
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
}

/** 确保目录存在 */
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * 抽取视频首帧作为卡片封面
 *
 * -ss 放在 -i 之前走「输入 seek」，无需解码整段视频，4K 源也能秒出。
 * 可用环境变量覆盖：WALLPAPER_POSTER_WIDTH=320 封面最大宽度
 */
function makePoster(input, output) {
  const maxWidth = Number(process.env.WALLPAPER_POSTER_WIDTH || 320);
  execFileSync(
    ffmpegPath,
    [
      "-y",
      "-ss",
      "0",
      "-i",
      input,
      "-frames:v",
      "1",
      "-vf",
      `scale='min(${maxWidth},iw)':-2`,
      "-q:v",
      "5",
      output,
    ],
    { stdio: ["ignore", "ignore", "inherit"] },
  );
}

// ============================================================
// 主流程
// ============================================================
const files = fs.readdirSync(themeDir);

// ============================================================
// 可选模式：--recompress 对已有 -loop.mp4 做体积瘦身
//   用法：node scripts/generate-wallpapers.js --recompress
//   仅重压缩超过阈值的视频，压缩到临时文件后原子替换，避免中断损坏。
// ============================================================
const RECOMPRESS = process.argv.includes("--recompress");
// 只重压缩大于该体积（MB）的文件，避免对小文件做无谓处理
const RECOMPRESS_MIN_MB = Number(process.env.WALLPAPER_RECOMPRESS_MIN_MB || 1.5);

if (RECOMPRESS) {
  const loopFiles = files.filter((f) => f.endsWith("-loop.mp4"));
  const targets = loopFiles
    .map((f) => ({ file: f, size: fs.statSync(path.join(themeDir, f)).size }))
    .filter((t) => t.size / 1024 / 1024 >= RECOMPRESS_MIN_MB)
    .sort((a, b) => b.size - a.size);

  console.log(
    `\n[recompress] 共 ${loopFiles.length} 个 loop 视频，` +
      `其中 ${targets.length} 个 ≥ ${RECOMPRESS_MIN_MB}MB 需要瘦身`,
  );
  console.log(
    `[recompress] 参数：最宽 ${process.env.WALLPAPER_MAX_WIDTH || 1280}px，` +
      `${process.env.WALLPAPER_FPS || 30}fps，CRF ${process.env.WALLPAPER_CRF || 26}，` +
      `preset=${process.env.WALLPAPER_PRESET || "medium"}\n`,
  );

  let beforeTotal = 0;
  let afterTotal = 0;

  for (const { file, size } of targets) {
    const input = path.join(themeDir, file);
    const tmp = path.join(themeDir, `${file}.tmp.mp4`);
    beforeTotal += size;
    const startedAt = Date.now();
    console.log(`重压缩: ${file}（${(size / 1024 / 1024).toFixed(2)} MB）`);
    try {
      recompressLoop(input, tmp);
      const newSize = fs.statSync(tmp).size;
      const ratio = ((1 - newSize / size) * 100).toFixed(1);
      // 只有确实变小才替换，否则保留原文件
      if (newSize < size) {
        fs.renameSync(tmp, input);
        afterTotal += newSize;
        const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(
          `  完成: ${(newSize / 1024 / 1024).toFixed(2)} MB ` + `(↓${ratio}%, 耗时 ${seconds}s)`,
        );
      } else {
        fs.unlinkSync(tmp);
        afterTotal += size;
        console.log(`  跳过（重压缩后未变小，保留原文件）`);
      }
    } catch (err) {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
      afterTotal += size;
      console.error(`  失败: ${(err.stderr || err.message || "").toString().slice(-300)}`);
    }
  }

  const saved = (beforeTotal - afterTotal) / 1024 / 1024;
  console.log(
    `\n[recompress] 完成：${(beforeTotal / 1024 / 1024).toFixed(1)} MB → ` +
      `${(afterTotal / 1024 / 1024).toFixed(1)} MB，共节省 ${saved.toFixed(1)} MB`,
  );
  process.exit(0);
}

// 第一步：处理需要转换的源视频（生成 -loop.mp4 后删除源文件）
for (const file of files) {
  const ext = path.extname(file).toLowerCase();
  if (!VIDEO_EXT.includes(ext)) continue;
  if (file.includes("-loop")) continue; // 跳过已生成的 loop 文件

  const input = path.join(themeDir, file);
  const loopName = file.replace(ext, "-loop.mp4");
  const loopPath = path.join(themeDir, loopName);

  // 已存在且比源文件新 → 跳过处理
  if (fs.existsSync(loopPath) && mtime(loopPath) >= mtime(input)) {
    console.log(`跳过（已最新）: ${file}`);
  } else {
    const startedAt = Date.now();
    console.log(
      `处理视频: ${file}（最长 ${process.env.WALLPAPER_MAX_SECONDS || 15}s，` +
        `最宽 ${process.env.WALLPAPER_MAX_WIDTH || 1920}px，` +
        `preset=${process.env.WALLPAPER_PRESET || "veryfast"}）`,
    );
    try {
      makeSeamlessLoop(input, loopPath);
      const sizeMB = (fs.statSync(loopPath).size / 1024 / 1024).toFixed(2);
      const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
      console.log(`  完成: ${loopName} (${sizeMB} MB, 耗时 ${seconds}s)`);
    } catch (err) {
      console.error(`  失败: ${(err.stderr || err.message || "").toString().slice(-300)}`);
      continue; // 失败则保留源文件，下次重试
    }
  }

  // 生成 loop 成功后，删除原始视频（避免冗余堆积）
  // 文件可能被 dev 服务器/浏览器占用，重试几次
  let deleted = false;
  for (let attempt = 0; attempt < 3 && !deleted; attempt++) {
    try {
      fs.unlinkSync(input);
      deleted = true;
      console.log(`  已删除源视频: ${file}`);
    } catch (err) {
      if (attempt < 2) {
        // 短暂等待后重试（用 Atomics.wait 睡眠，避免忙等空转 CPU）
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 300);
      } else {
        console.warn(`  删除源视频失败（文件被占用，下次运行会重试）: ${file}`);
      }
    }
  }
}

// 第二步：收集所有壁纸（重新扫描，因为源视频可能已被删除）
const finalFiles = fs.readdirSync(themeDir);
const wallpapers = [];
// 复用已有 name（人工翻译的中文名），按 url 匹配，只有新壁纸才走 extractName
const existingNames = readExistingNames();

// 已处理的 loop 文件名集合（用于判断源视频是否已有 loop 版本）
const loopNames = new Set(finalFiles.filter((f) => f.endsWith("-loop.mp4")));

/**
 * 为视频生成卡片封面
 * @returns { poster?: string } 失败时返回空对象，组件会自动退化为直接加载视频
 */
function buildPoster(videoFile) {
  const videoPath = path.join(themeDir, videoFile);
  const posterName = videoFile.replace(/\.mp4$/i, ".jpg");
  const posterPath = path.join(postersDir, posterName);

  try {
    ensureDir(postersDir);
    // 已存在且比视频新 → 直接复用
    if (fs.existsSync(posterPath) && mtime(posterPath) >= mtime(videoPath)) {
      return { poster: `/theme/posters/${posterName}` };
    }
    makePoster(videoPath, posterPath);
    const sizeKB = (fs.statSync(posterPath).size / 1024).toFixed(0);
    console.log(`  封面: ${posterName} (${sizeKB} KB)`);
    return { poster: `/theme/posters/${posterName}` };
  } catch (err) {
    console.warn(`  封面生成失败（将直接加载视频）: ${videoFile}`);
    return {};
  }
}

for (const file of finalFiles) {
  const ext = path.extname(file).toLowerCase();

  // -loop.mp4 → 视频壁纸（名称去掉 -loop），并抽取首帧封面
  if (file.endsWith("-loop.mp4")) {
    wallpapers.push({
      name: existingNames[`/theme/${file}`] || extractName(file),
      type: "video",
      url: `/theme/${file}`,
      ...buildPoster(file),
    });
  } else if (VIDEO_EXT.includes(ext)) {
    // 源视频：如果已有对应的 -loop.mp4，跳过（避免重复）
    const loopName = file.replace(ext, "-loop.mp4");
    if (loopNames.has(loopName)) continue;
    // 未处理的源视频（转换失败的）→ 直接用原文件
    wallpapers.push({
      name: existingNames[`/theme/${file}`] || extractName(file),
      type: "video",
      url: `/theme/${file}`,
    });
  } else if (IMAGE_EXT.includes(ext)) {
    // 图片：直接使用
    wallpapers.push({
      name: existingNames[`/theme/${file}`] || extractName(file),
      type: "image",
      url: `/theme/${file}`,
    });
  }
}

// ============================================================
// 生成 TS 文件
// ============================================================
const tsContent = `/**
 * ⚠️ 本文件由 scripts/generate-wallpapers.js 自动生成，请勿手动修改。
 * 重新生成：node scripts/generate-wallpapers.js
 */

export interface DynamicWallpaper {
  name: string;
  type: "video" | "image";
  url: string;
  /** 视频首帧封面；缺省时卡片会直接加载视频本体 */
  poster?: string;
}

export const DYNAMIC_WALLPAPERS: DynamicWallpaper[] = ${JSON.stringify(wallpapers, null, 2)};
`;

fs.writeFileSync(outTsFile, tsContent, "utf8");

console.log(`\n共 ${wallpapers.length} 个壁纸`);
console.log(`已生成: ${path.relative(process.cwd(), outTsFile)}`);
