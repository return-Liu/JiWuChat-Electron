/**
 * WAV -> MP3 转换脚本（一次性工具）
 *
 * 用途：把体积过大的未压缩 WAV 铃声转为 MP3，显著减小安装包体积。
 * 依赖：lamejs（纯 JS MP3 编码器）
 *
 * 用法：node scripts/wav-to-mp3.js <输入.wav> <输出.mp3> [比特率kbps]
 */
const fs = require("node:fs");
const path = require("node:path");

function parseWav(buffer) {
  // 校验 RIFF/WAVE
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new Error("不是合法的 WAV 文件");
  }

  let offset = 12;
  let fmt = null;
  let dataStart = -1;
  let dataLength = 0;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkDataStart = offset + 8;

    if (chunkId === "fmt ") {
      fmt = {
        audioFormat: buffer.readUInt16LE(chunkDataStart),
        channels: buffer.readUInt16LE(chunkDataStart + 2),
        sampleRate: buffer.readUInt32LE(chunkDataStart + 4),
        bitsPerSample: buffer.readUInt16LE(chunkDataStart + 14),
      };
    } else if (chunkId === "data") {
      dataStart = chunkDataStart;
      dataLength = chunkSize;
    }

    offset = chunkDataStart + chunkSize + (chunkSize % 2); // 块对齐
  }

  if (!fmt || dataStart < 0) throw new Error("WAV 缺少 fmt 或 data 块");
  return { fmt, dataStart, dataLength };
}

/**
 * 把任意位深的 PCM 转成 16-bit 有符号整数样本数组（按声道拆分）。
 */
function toInt16Samples(buffer, dataStart, dataLength, fmt) {
  const { channels, bitsPerSample } = fmt;
  const bytesPerSample = bitsPerSample / 8;
  const frameCount = Math.floor(dataLength / (bytesPerSample * channels));

  const left = new Int16Array(frameCount);
  const right = channels > 1 ? new Int16Array(frameCount) : null;

  for (let i = 0; i < frameCount; i++) {
    for (let c = 0; c < channels; c++) {
      const pos = dataStart + (i * channels + c) * bytesPerSample;
      let sample;
      if (bitsPerSample === 16) {
        sample = buffer.readInt16LE(pos);
      } else if (bitsPerSample === 32) {
        // 32-bit：可能是 float32 或 int32。WAV 常见为 float32（audioFormat=3）
        if (fmt.audioFormat === 3) {
          sample = Math.max(-1, Math.min(1, buffer.readFloatLE(pos))) * 32767;
        } else {
          sample = buffer.readInt32LE(pos) >> 16; // int32 -> int16
        }
      } else if (bitsPerSample === 8) {
        sample = (buffer.readUInt8(pos) - 128) << 8;
      } else if (bitsPerSample === 24) {
        const b0 = buffer.readUInt8(pos);
        const b1 = buffer.readUInt8(pos + 1);
        const b2 = buffer.readInt8(pos + 2);
        sample = ((b2 << 16) | (b1 << 8) | b0) >> 8;
      } else {
        throw new Error(`不支持的位深：${bitsPerSample}`);
      }
      sample = Math.max(-32768, Math.min(32767, Math.round(sample)));
      if (c === 0) left[i] = sample;
      else if (c === 1 && right) right[i] = sample;
    }
  }

  return { left, right, frameCount };
}

async function main() {
  const [input, output, bitrateArg] = process.argv.slice(2);
  if (!input || !output) {
    console.error("用法: node scripts/wav-to-mp3.js <输入.wav> <输出.mp3> [比特率kbps]");
    process.exit(1);
  }
  const kbps = parseInt(bitrateArg || "128", 10);

  // @breezystack/lamejs 是 ESM 模块，使用动态 import 加载
  const lameMod = await import("@breezystack/lamejs");
  const lamejs = lameMod.default || lameMod;
  const Mp3Encoder = lamejs.Mp3Encoder;
  if (!Mp3Encoder) {
    throw new Error("无法从 @breezystack/lamejs 获取 Mp3Encoder");
  }

  const buffer = fs.readFileSync(input);
  const { fmt, dataStart, dataLength } = parseWav(buffer);
  console.log(
    `[wav-to-mp3] 输入: ${fmt.channels}ch / ${fmt.sampleRate}Hz / ${fmt.bitsPerSample}bit`,
  );

  const { left, right, frameCount } = toInt16Samples(buffer, dataStart, dataLength, fmt);
  console.log(
    `[wav-to-mp3] 采样帧数: ${frameCount}（约 ${(frameCount / fmt.sampleRate).toFixed(1)} 秒）`,
  );

  const encoder = new Mp3Encoder(fmt.channels, fmt.sampleRate, kbps);
  const blockSize = 1152;
  const chunks = [];

  for (let i = 0; i < frameCount; i += blockSize) {
    const leftChunk = left.subarray(i, i + blockSize);
    let mp3buf;
    if (fmt.channels > 1 && right) {
      const rightChunk = right.subarray(i, i + blockSize);
      mp3buf = encoder.encodeBuffer(leftChunk, rightChunk);
    } else {
      mp3buf = encoder.encodeBuffer(leftChunk);
    }
    if (mp3buf.length > 0) chunks.push(Buffer.from(mp3buf));
  }

  const end = encoder.flush();
  if (end.length > 0) chunks.push(Buffer.from(end));

  const out = Buffer.concat(chunks);
  fs.writeFileSync(output, out);

  const inSize = (buffer.length / 1024 / 1024).toFixed(2);
  const outSize = (out.length / 1024 / 1024).toFixed(2);
  console.log(`[wav-to-mp3] 完成: ${inSize} MB -> ${outSize} MB`);
}

main().catch((err) => {
  console.error("[wav-to-mp3] 转换失败:", err);
  process.exit(1);
});
