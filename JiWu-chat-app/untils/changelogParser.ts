/**
 * 更新日志 Markdown 结构化解析器。
 *
 * 后端 UpdateLog.content 存的是 Markdown 版本说明，本模块负责从中定向提取
 * 「导语 / 更新说明 / 后续计划」三段，供前端结构化渲染（编号排版），
 * 不使用 markdown-it 整段渲染。
 */

/** 手写 bullet：拆出加粗前缀与正文 */
export interface HandwrittenBullet {
  bold: string | null;
  text: string;
}

/** 手写「更新说明」子分区 */
export interface HandwrittenSection {
  heading: string | null;
  bullets: HandwrittenBullet[];
}

/** 通用内容块：一个大标题（## ）及其下的正文（列表 / 段落） */
export interface ContentSection {
  /** 大标题文本；无标题的导语块为 null */
  heading: string | null;
  /** 列表条目 */
  bullets: HandwrittenBullet[];
  /** 非列表的普通段落 */
  paragraphs: string[];
}

/** 下载项 */
export interface DownloadItem {
  platform: string;
  name: string;
  url: string;
}

/** 从版本说明 Markdown 提取的手写内容 */
export interface HandwrittenContent {
  intro: string;
  summary: HandwrittenSection[];
  plans: string[];
  downloads: DownloadItem[];
  /** 按 ## 大标题切分的通用内容块（含任意自定义大标题） */
  sections: ContentSection[];
}

/** 去除行内 markdown 标记（**、` 等），返回纯文本 */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .trim();
}

/** 解析一条 bullet：拆出 **加粗前缀** 与正文 */
function parseBullet(line: string): HandwrittenBullet {
  const content = line.replace(/^\s*[-*]\s+/, "").trim();
  const boldMatch = content.match(/^\*\*([^*]+)\*\*\s*[:：]?\s*(.*)$/);
  if (boldMatch) {
    return {
      bold: stripInlineMarkdown(boldMatch[1]),
      text: stripInlineMarkdown(boldMatch[2]),
    };
  }
  return { bold: null, text: stripInlineMarkdown(content) };
}

/** 提取导语段落（「# xxx版本说明」之后、「## 更新说明」之前的第一段文字） */
function extractIntro(lines: string[]): string {
  const idx = lines.findIndex((l) => /^##\s+/.test(l.trim()));
  for (let i = (idx === -1 ? lines.length : idx) - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;
    if (/^#+\s+/.test(line)) break;
    if (line.startsWith("[")) continue;
    if (line.startsWith("**Full Changelog")) continue;
    return stripInlineMarkdown(line);
  }
  return "";
}

/** 从「下载」表格提取下载项（平台 / 文件名 / 地址），跳过「通用」安装包条目 */
function extractDownloads(lines: string[]): DownloadItem[] {
  const result: DownloadItem[] = [];
  let inDownloads = false;

  for (const raw of lines) {
    const line = raw.trim();
    if (!inDownloads) {
      if (/^#{2,3}\s*下载\s*$/.test(line)) {
        inDownloads = true;
      }
      continue;
    }
    if (/^##\s+/.test(line)) break; // 下一个二级标题结束

    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c !== "");
    if (cells.length < 2) continue;
    // 跳过表头（平台/下载地址）与分隔行（---）
    if (cells[0] === "平台" || /^:?-{2,}:?$/.test(cells[0])) continue;

    const platform = stripInlineMarkdown(cells[0]);
    // 跳过「通用安装包」这类不带架构的条目（如 Windows 通用 x64 + ia32）
    if (platform.includes("通用")) continue;

    const linkMatch = cells[1].match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      result.push({ platform, name: linkMatch[1], url: linkMatch[2] });
    } else if (cells[1]) {
      result.push({ platform, name: stripInlineMarkdown(cells[1]), url: "" });
    }
  }

  return result;
}

/**
 * 按「## 大标题」切分内容，得到通用内容块列表。
 * 大标题之前的正文作为 heading=null 的导语块。
 * 每个块内区分列表条目（- / *）与普通段落。
 */
function extractSections(lines: string[]): ContentSection[] {
  const result: ContentSection[] = [];
  let current: ContentSection | null = null;

  const ensure = (): ContentSection => {
    if (!current) {
      current = { heading: null, bullets: [], paragraphs: [] };
      result.push(current);
    }
    return current;
  };

  for (const raw of lines) {
    const line = raw.trim();

    // 跳过下载表格区（由 extractDownloads 单独处理）
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      current = { heading: stripInlineMarkdown(h2[1]), bullets: [], paragraphs: [] };
      result.push(current);
      continue;
    }

    if (!line) continue;
    if (/^###\s+/.test(line)) continue; // 三级标题归入所属块，不单独建块
    if (line.startsWith("|") || /^:?-{2,}:?$/.test(line)) continue; // 表格行
    if (line.startsWith("[")) continue;
    if (line.startsWith("**Full Changelog")) continue;

    if (/^[-*]\s+/.test(line)) {
      ensure().bullets.push(parseBullet(line));
    } else {
      ensure().paragraphs.push(stripInlineMarkdown(line));
    }
  }

  // 丢弃完全空白的块
  return result.filter((s) => s.heading || s.bullets.length > 0 || s.paragraphs.length > 0);
}

/** 从版本说明 Markdown 提取手写的「更新说明」与「后续计划」区块 */
export function extractHandwrittenContent(body: string): HandwrittenContent {
  const result: HandwrittenContent = {
    intro: "",
    summary: [],
    plans: [],
    downloads: [],
    sections: [],
  };
  if (!body) return result;

  const lines = body.split(/\r?\n/);
  result.intro = extractIntro(lines);
  result.downloads = extractDownloads(lines);
  result.sections = extractSections(lines);

  // 判断是否有「更新说明」区块
  const hasUpdateSection = lines.some((l) => /^#{2,3}\s*更新说明\s*$/.test(l.trim()));

  if (hasUpdateSection) {
    // 标准模式：提取「更新说明」
    let inSummary = false;
    let current: HandwrittenSection | null = null;
    for (const raw of lines) {
      const line = raw.trim();
      if (!inSummary) {
        if (/^#{2,3}\s*更新说明\s*$/.test(line)) {
          inSummary = true;
          current = null;
        }
        continue;
      }
      if (/^##\s+/.test(line)) break; // 下一个二级标题结束
      const sub = line.match(/^###\s+(.+)$/);
      if (sub) {
        current = { heading: stripInlineMarkdown(sub[1]), bullets: [] };
        result.summary.push(current);
        continue;
      }
      if (/^[-*]\s+/.test(line)) {
        if (!current) {
          current = { heading: null, bullets: [] };
          result.summary.push(current);
        }
        current.bullets.push(parseBullet(line));
      }
    }
  } else {
    // 首版模式：提取所有主要区块（跳过下载、许可证、技术栈等元信息）
    const SKIP = new Set(["下载", "许可证", "技术栈"]);
    let container: string | null = null;
    let current: HandwrittenSection | null = null;
    let skip = false;
    for (const raw of lines) {
      const line = raw.trim();
      const h2 = line.match(/^##\s+(.+)$/);
      if (h2) {
        const title = stripInlineMarkdown(h2[1]);
        skip = SKIP.has(title);
        container = skip ? null : title;
        current = null;
        continue;
      }
      if (skip || !container) continue;
      const sub = line.match(/^###\s+(.+)$/);
      if (sub) {
        current = { heading: stripInlineMarkdown(sub[1]), bullets: [] };
        result.summary.push(current);
        continue;
      }
      if (/^[-*]\s+/.test(line)) {
        if (!current) {
          current = { heading: container, bullets: [] };
          result.summary.push(current);
        }
        current.bullets.push(parseBullet(line));
      }
    }
  }

  // 提取「后续计划」
  let inPlans = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (!inPlans) {
      if (/^#{2,3}\s*后续计划\s*$/.test(line)) {
        inPlans = true;
      }
      continue;
    }
    if (/^##\s+/.test(line)) break;
    if (/^[-*]\s+/.test(line)) {
      result.plans.push(parseBullet(line).text);
    }
  }

  return result;
}
