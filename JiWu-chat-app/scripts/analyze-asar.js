/**
 * 分析 app.asar 内部体积构成（支持指定子目录）。
 * 用法：node scripts/analyze-asar.js <app.asar 路径> [子目录名]
 */
const fs = require("node:fs");

const asarPath = process.argv[2];
const subDir = process.argv[3];

if (!asarPath || !fs.existsSync(asarPath)) {
  console.error("用法: node scripts/analyze-asar.js <app.asar 路径> [子目录名]");
  process.exit(1);
}

const fd = fs.openSync(asarPath, "r");
const header = Buffer.alloc(16);
fs.readSync(fd, header, 0, 16, 0);
const jsonLen = header.readUInt32LE(12);
const jsonBuf = Buffer.alloc(jsonLen);
fs.readSync(fd, jsonBuf, 0, jsonLen, 16);
fs.closeSync(fd);

const index = JSON.parse(jsonBuf.toString("utf8"));

const sizes = {};
function walk(node, topName) {
  if (node.files) {
    for (const [name, child] of Object.entries(node.files)) {
      walk(child, topName || name);
    }
  } else if (typeof node.size === "number") {
    sizes[topName] = (sizes[topName] || 0) + node.size;
  }
}

let root = index;
if (subDir) {
  for (const part of subDir.split("/")) {
    root = root.files?.[part];
    if (!root) {
      console.error(`未找到子目录: ${subDir}`);
      process.exit(1);
    }
  }
}

for (const [name, node] of Object.entries(root.files || {})) {
  walk(node, name);
}

const sum = Object.values(sizes).reduce((a, b) => a + b, 0);
const rows = Object.entries(sizes)
  .map(([k, v]) => ({ name: k, mb: v / 1024 / 1024 }))
  .sort((a, b) => b.mb - a.mb);

console.log(`\n=== ${subDir || "asar 根"} 总大小: ${(sum / 1024 / 1024).toFixed(2)} MB ===\n`);
console.log("名称".padEnd(30) + "大小(MB)");
console.log("-".repeat(42));
for (const r of rows) {
  console.log(r.name.padEnd(30) + r.mb.toFixed(2));
}
