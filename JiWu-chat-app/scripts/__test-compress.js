const { execFileSync } = require("child_process");
const ff = require("@ffmpeg-installer/ffmpeg").path;
const fs = require("fs");

const f = "public/theme/arknights-mizuki-caerula-arbor-loop.mp4";
const out = "public/theme/__test__-loop.mp4";
const t = Date.now();
execFileSync(
  ff,
  [
    "-y",
    "-i",
    f,
    "-vf",
    "scale='min(1280,iw)':-2:flags=bicubic,fps=30",
    "-an",
    "-c:v",
    "libx264",
    "-preset",
    "medium",
    "-crf",
    "26",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    out,
  ],
  { stdio: ["ignore", "ignore", "inherit"] },
);
const a = fs.statSync(f).size;
const b = fs.statSync(out).size;
console.log(
  `原: ${(a / 1048576).toFixed(2)} MB -> 新: ${(b / 1048576).toFixed(2)} MB  降幅: ${((1 - b / a) * 100).toFixed(1)}%  耗时: ${((Date.now() - t) / 1000).toFixed(1)}s`,
);
