/**
 * 从视频 / 图片中提取主色调（用于动态主题的选中态配色）
 */

/**
 * 将 RGB 转为 hex
 */
const rgbToHex = (r: number, g: number, b: number): string =>
    "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

/**
 * 从 canvas 图像数据中提取主色
 * 策略：优先提取画面中「最鲜艳」的像素（高饱和度），
 * 这样即使整体色调统一，也能捕捉到画面亮点色，且随画面变化。
 * @param data ImageData.data
 */
const extractDominantFromImageData = (data: Uint8ClampedArray): string => {
    // 收集所有有效像素及其饱和度
    const pixels: { r: number; g: number; b: number; s: number; v: number }[] = [];

    for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 125) continue; // 跳过透明像素
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const brightness = max / 255;
        // 跳过过暗 / 过亮（避免黑边、白边干扰）
        if (brightness < 0.08 || brightness > 0.97) continue;

        const saturation = max === 0 ? 0 : (max - min) / max;
        pixels.push({ r, g, b, s: saturation, v: brightness });
    }

    let r = 148,
        g = 163,
        b = 184;

    if (pixels.length > 0) {
        // 按饱和度降序排序，取最鲜艳的前 20% 像素
        pixels.sort((a, b) => b.s - a.s);
        const topCount = Math.max(1, Math.floor(pixels.length * 0.2));
        const top = pixels.slice(0, topCount);

        // 前 20% 的平均饱和度
        const avgTopSat = top.reduce((sum, p) => sum + p.s, 0) / top.length;

        // 若前 20% 有明显色彩（平均饱和度 > 0.15），用它们作为主色
        const useSet = avgTopSat > 0.15 ? top : pixels;

        // 加权平均（饱和度越高权重越大，突出鲜艳色）
        let sr = 0,
            sg = 0,
            sb = 0,
            sw = 0;
        for (const p of useSet) {
            const w = 0.5 + p.s * 3; // 饱和度权重
            sr += p.r * w;
            sg += p.g * w;
            sb += p.b * w;
            sw += w;
        }
        r = sr / sw;
        g = sg / sw;
        b = sb / sw;
    }

    // 强制增强饱和度，让选中色鲜明
    const avg = (r + g + b) / 3;
    const boost = 1.6;
    let nr = avg + (r - avg) * boost;
    let ng = avg + (g - avg) * boost;
    let nb = avg + (b - avg) * boost;

    // 若增强后仍接近灰（饱和度极低），给一个偏蓝紫的默认倾向
    const nmax = Math.max(nr, ng, nb);
    const nmin = Math.min(nr, ng, nb);
    if (nmax > 0 && (nmax - nmin) / nmax < 0.1) {
        nr = nr * 0.8 + 99 * 0.2;
        ng = ng * 0.8 + 102 * 0.2;
        nb = nb * 0.8 + 241 * 0.2;
    }

    return rgbToHex(nr, ng, nb);
};

/**
 * 从视频元素当前帧提取主色
 */
export const extractColorFromVideo = (video: HTMLVideoElement): string | null => {
    try {
        if (!video || video.readyState < 2 || video.videoWidth === 0) return null;
        const canvas = document.createElement("canvas");
        const w = 128;
        const h = 128;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(video, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        return extractDominantFromImageData(imageData.data);
    } catch {
        return null;
    }
};

/**
 * 从图片元素提取主色
 */
export const extractColorFromImage = (img: HTMLImageElement): string | null => {
    try {
        if (!img || !img.complete || img.naturalWidth === 0) return null;
        const canvas = document.createElement("canvas");
        const w = 64;
        const h = 64;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        return extractDominantFromImageData(imageData.data);
    } catch {
        return null;
    }
};

/**
 * 从图片 URL 提取主色（异步，用于视频封面等）
 */
export const extractColorFromUrl = (url: string): Promise<string | null> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(extractColorFromImage(img));
        img.onerror = () => resolve(null);
        img.src = url;
    });
};

/**
 * 从视频多帧采样，取平均主色（更准确、更稳定）
 * 采样多个时间点的帧，分别取色后求平均。
 * @param video 视频元素
 * @param samples 采样帧数（默认 5）
 */
export const extractColorFromVideoMultiFrame = (
    video: HTMLVideoElement,
    samples: number = 5,
): string | null => {
    try {
        if (!video || video.readyState < 2 || video.videoWidth === 0) return null;
        const duration = video.duration;
        if (!duration || duration <= 0) return extractColorFromVideo(video);

        const colors: [number, number, number][] = [];
        const originalTime = video.currentTime;

        for (let i = 0; i < samples; i++) {
            // 均匀采样（避开首尾 5%）
            const t = duration * (0.05 + (0.9 * i) / (samples - 1 || 1));
            video.currentTime = t;
            // 同步读取当前帧（seek 后立即绘制可能拿到旧帧，但多数情况可接受）
            const color = extractColorFromVideo(video);
            if (color) {
                const rgb = hexToRgbArr(color);
                if (rgb) colors.push(rgb);
            }
        }

        // 恢复原时间
        video.currentTime = originalTime;

        if (colors.length === 0) return null;
        // 求平均
        const avg = colors.reduce(
            (acc, c) => [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]] as [number, number, number],
            [0, 0, 0] as [number, number, number],
        );
        const n = colors.length;
        return rgbToHex(avg[0] / n, avg[1] / n, avg[2] / n);
    } catch {
        return null;
    }
};

/** hex 转 [r,g,b] */
const hexToRgbArr = (hex: string): [number, number, number] | null => {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return null;
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
};
