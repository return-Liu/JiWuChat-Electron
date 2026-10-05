<template>
  <div class="static-changelog">
    <!-- 头部 -->
    <header class="changelog-header">
      <div class="header-left">
        <h1>更新日志</h1>
        <div class="stats">
          <span>共 {{ entries.length }} 个版本</span>
        </div>
      </div>
    </header>

    <!-- 空状态 -->
    <div v-if="entries.length === 0" class="state-box">
      <p>暂无发布版本</p>
    </div>

    <!-- 三栏布局 -->
    <div v-else class="changelog-layout">
      <!-- 左侧：版本号列表 -->
      <aside class="version-sidebar">
        <h3 class="sidebar-title">版本列表</h3>
        <ul class="version-nav">
          <li
            v-for="e in entries"
            :key="e.tag"
            class="version-item"
            :class="{ active: selectedTag === e.tag }"
            @click="selectedTag = e.tag"
          >
            <span class="version-tag">{{ e.tag }}</span>
            <span v-if="e.prerelease" class="pre-badge">预发布</span>
            <span class="version-date">{{ e.date }}</span>
          </li>
        </ul>
      </aside>

      <!-- 中间：版本内容 -->
      <main class="release-main">
        <div v-if="currentEntry" class="release-content">
          <div class="release-header">
            <h2 class="release-title">{{ currentEntry.title || currentEntry.tag }}</h2>
            <div class="release-meta">
              <span class="release-date">发布于 {{ currentEntry.date }}</span>
            </div>
          </div>

          <div class="release-body markdown-body" v-html="renderMarkdown(currentEntry.body)"></div>
        </div>
      </main>

      <!-- 右侧：标题导航（目录） -->
      <aside class="toc-sidebar">
        <h3 class="sidebar-title">目录</h3>
        <ul v-if="headings.length > 0" class="toc-nav">
          <li
            v-for="(h, idx) in headings"
            :key="idx"
            class="toc-item"
            :class="`toc-level-${h.level}`"
            @click="scrollToHeading(h.anchor)"
          >
            {{ h.text }}
          </li>
        </ul>
        <p v-else class="toc-empty">本版本无标题</p>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick } from "vue";
import { CHANGELOG_DATA } from "../untils/changelogData";
import { renderMarkdown } from "../untils/markdownRenderer";
import "highlight.js/styles/github.css";

const entries = CHANGELOG_DATA;
const selectedTag = ref(entries.length > 0 ? entries[0].tag : "");

const currentEntry = computed(() => {
  return entries.find((e) => e.tag === selectedTag.value) || null;
});

/** 从正文提取标题（h1~h4），用于目录导航 */
const headings = computed(() => {
  const body = currentEntry.value?.body || "";
  const result: { level: number; text: string; anchor: string }[] = [];
  const seen = new Map<string, number>();
  for (const line of body.split("\n")) {
    const match = line.match(/^(#{1,4})\s+(.+)$/);
    if (!match) continue;
    const level = match[1].length;
    const text = match[2].trim().replace(/[*_`~]/g, "");
    if (!text) continue;
    let anchor = text
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const count = seen.get(anchor) || 0;
    seen.set(anchor, count + 1);
    if (count > 0) anchor = `${anchor}-${count}`;
    result.push({ level, text, anchor });
  }
  return result;
});

/** 滚动到指定标题 */
const scrollToHeading = async (anchor: string) => {
  await nextTick();
  const el = document.querySelector(`#${CSS.escape(anchor)}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};
</script>

<style scoped>
.static-changelog {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.changelog-header {
  flex-shrink: 0;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

.header-left h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.stats {
  margin-top: 6px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
}

.state-box {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #6b7280);
  padding: 40px;
}

/* 三栏布局 */
.changelog-layout {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* 左侧版本列表 */
.version-sidebar {
  width: 220px;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color, #e5e7eb);
  padding: 16px 12px;
  overflow-y: auto;
}

.sidebar-title {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary, #6b7280);
  padding: 0 8px;
}

.version-nav {
  list-style: none;
  padding: 0;
  margin: 0;
}

.version-item {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
  margin-bottom: 4px;
}

.version-item:hover {
  background: var(--hover-bg, #f3f4f6);
}

.version-item.active {
  background: rgba(93, 51, 246, 0.08);
}

.version-tag {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.version-item.active .version-tag {
  color: #5d33f6;
}

.pre-badge {
  display: inline-block;
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f59e0b;
  color: #fff;
  margin-top: 4px;
}

.version-date {
  display: block;
  font-size: 12px;
  color: var(--text-secondary, #9ca3af);
  margin-top: 4px;
}

/* 中间内容 */
.release-main {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
}

.release-content {
  max-width: 760px;
  margin: 0 auto;
}

.release-header {
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color, #e5e7eb);
  margin-bottom: 20px;
}

.release-title {
  margin: 0 0 12px;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary, #111827);
}

.release-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
}

.release-body {
  font-size: 15px;
  line-height: 1.7;
  color: var(--text-primary, #111827);
}

/* 右侧目录 */
.toc-sidebar {
  width: 200px;
  flex-shrink: 0;
  border-left: 1px solid var(--border-color, #e5e7eb);
  padding: 16px 12px;
  overflow-y: auto;
}

.toc-nav {
  list-style: none;
  padding: 0;
  margin: 0;
}

.toc-item {
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 6px;
  transition: background 0.2s;
}

.toc-item:hover {
  background: var(--hover-bg, #f3f4f6);
  color: var(--text-primary, #111827);
}

.toc-level-1 {
  font-weight: 600;
}

.toc-level-2 {
  padding-left: 20px;
}

.toc-level-3 {
  padding-left: 32px;
}

.toc-level-4 {
  padding-left: 44px;
}

.toc-empty {
  font-size: 13px;
  color: var(--text-secondary, #9ca3af);
  padding: 0 8px;
}
</style>
