<template>
  <div class="github-changelog">
    <!-- 加载状态 -->
    <div v-if="loading" class="state-box">
      <span class="spinner"></span>
      <span>正在加载更新日志...</span>
    </div>

    <!-- 错误状态 -->
    <div v-else-if="error" class="state-box">
      <p>{{ error }}</p>
      <button class="retry-btn" @click="loadReleases">重试</button>
    </div>

    <!-- 空状态 -->
    <div v-else-if="releases.length === 0" class="state-box">
      <p>暂无发布版本</p>
    </div>

    <!-- 三栏布局 -->
    <div v-else class="changelog-layout">
      <!-- 左侧：版本列表（按主版本分组） -->
      <aside class="version-sidebar">
        <h3 class="sidebar-title">版本列表</h3>
        <div v-for="g in versionGroups" :key="g.major" class="version-group">
          <div class="version-group-label">{{ g.label }}</div>
          <ul class="version-nav">
            <li
              v-for="r in g.releases"
              :key="r.version"
              class="version-item"
              :class="{ active: selectedTag === r.version }"
              @click="selectRelease(r.version)"
            >
              <span class="version-tag">{{ r.version }}</span>
              <span class="version-date">{{ formatDate(r.releaseDate) }}</span>
            </li>
          </ul>
        </div>
      </aside>

      <!-- 中间：版本内容（结构化渲染） -->
      <main class="release-main">
        <div v-if="currentRelease" class="release-content">
          <div class="release-header">
            <h2 class="release-title">{{ releaseTitle }}</h2>
          </div>

          <!-- 导语 -->
          <p v-if="handwritten.intro" class="release-intro">{{ handwritten.intro }}</p>

          <!-- 手写：更新说明 -->
          <section v-if="handwritten.summary.length > 0" id="summary" class="category">
            <h3 class="category-title">更新说明</h3>
            <div v-for="(sec, si) in numberedSummary" :key="si" class="handwritten-section">
              <h4 v-if="sec.heading" class="handwritten-heading">{{ sec.heading }}</h4>
              <ul class="update-list">
                <li v-for="item in sec.bullets" :key="item.index" class="update-item">
                  <span class="update-index">{{ item.index }}</span>
                  <div class="update-body">
                    <span v-if="item.bullet.bold" class="update-title">{{ item.bullet.bold }}</span>
                    <span v-if="item.bullet.text" class="update-desc">{{ item.bullet.text }}</span>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          <!-- 手写：后续计划 -->
          <section v-if="handwritten.plans.length > 0" id="plans" class="category">
            <h3 class="category-title">后续计划</h3>
            <ul class="bullet-list">
              <li v-for="(p, pi) in handwritten.plans" :key="pi" class="bullet-item">{{ p }}</li>
            </ul>
          </section>

          <!-- 自定义大标题分区（内容块编辑器产出） -->
          <section
            v-for="(sec, si) in customSections"
            :key="`custom-${si}`"
            :id="`section-${si}`"
            class="category"
          >
            <h3 class="category-title">{{ sec.heading }}</h3>
            <p v-for="(para, pi) in sec.paragraphs" :key="`p-${pi}`" class="section-paragraph">
              {{ para }}
            </p>
            <ul v-if="sec.bullets.length > 0" class="bullet-list">
              <li v-for="(b, bi) in sec.bullets" :key="`b-${bi}`" class="bullet-item">
                <strong v-if="b.bold">{{ b.bold }}：</strong>{{ b.text }}
              </li>
            </ul>
          </section>

          <!-- 下载 -->
          <section v-if="handwritten.downloads.length > 0" id="downloads" class="category">
            <h3 class="category-title">下载</h3>
            <p class="download-tip">
              <a
                :href="`https://github.com/JiWuChat/JiWuChat/releases/tag/v${currentRelease.version.replace(/^v/, '')}`"
                target="_blank"
                rel="noopener noreferrer"
                >Windows x86_64 setup</a
              >
              &nbsp;|&nbsp;其他版本可在
              <a
                :href="`https://github.com/JiWuChat/JiWuChat/releases/tag/v${currentRelease.version.replace(/^v/, '')}`"
                target="_blank"
                rel="noopener noreferrer"
                >Release 页面</a
              >
              下载
              <br />
              Version Info:
              <a
                :href="`https://github.com/JiWuChat/JiWuChat/compare/v${currentRelease.version.replace(/^v/, '')}...main`"
                target="_blank"
                rel="noopener noreferrer"
                >Full Changelog</a
              >
            </p>
            <table class="download-table">
              <thead>
                <tr>
                  <th>平台</th>
                  <th>下载地址</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(d, di) in handwritten.downloads" :key="di">
                  <td>{{ d.platform }}</td>
                  <td>
                    <a v-if="d.url" :href="d.url" target="_blank" rel="noopener noreferrer">
                      {{ d.name }}
                    </a>
                    <span v-else>{{ d.name }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
            <p class="download-thanks">感谢大家的支持！❤️（Star ⭐ Fork 🍴 Issue 💬...）</p>
          </section>

          <!-- 翻页 -->
          <nav class="release-pager">
            <a v-if="prevRelease" class="pager-link" @click="goPrev">‹ {{ prevRelease.version }}</a>
            <span v-else class="pager-placeholder"></span>
            <a v-if="nextRelease" class="pager-link pager-next" @click="goNext">
              {{ nextRelease.version }} ›
            </a>
            <span v-else class="pager-placeholder"></span>
          </nav>
        </div>
      </main>

      <!-- 右侧：目录 -->
      <aside class="toc-sidebar">
        <h3 class="sidebar-title">目录</h3>
        <ul v-if="tocItems.length > 0" class="toc-nav">
          <li
            v-for="(item, idx) in tocItems"
            :key="idx"
            class="toc-item"
            @click="scrollToHeading(item.id)"
          >
            {{ item.text }}
          </li>
        </ul>
        <p v-else class="toc-empty">本版本无目录</p>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, nextTick, watch } from "vue";
import { useUpdateLogs } from "../composables/useUpdateLogs";

const props = defineProps<{ version?: string }>();
const emit = defineEmits<{ versionChange: [version: string] }>();

const {
  sortedLogs: releases,
  loading,
  error,
  selectedVersion: selectedTag,
  currentLog: currentRelease,
  handwritten,
  load: loadReleases,
  selectVersion,
} = useUpdateLogs(props.version);

/** 切换版本并通知父组件更新路由 */
function selectRelease(version: string) {
  selectVersion(version);
  emit("versionChange", version);
}

/** 路由版本号变化（浏览器前进/后退）时同步选中版本 */
watch(
  () => props.version,
  (v) => {
    if (v && v !== selectedTag.value) {
      selectVersion(v);
    }
  },
);

/** 左侧版本分组：按主版本号分组，标签用「最老版本 - 最新版本」范围，升序展示 */
const versionGroups = computed(() => {
  const map = new Map<number, { major: number; releases: typeof releases.value }>();
  for (const r of releases.value) {
    const major = parseInt(r.version.replace(/^v?/, "").split(".")[0], 10) || 0;
    if (!map.has(major)) {
      map.set(major, { major, releases: [] });
    }
    map.get(major)!.releases.push(r);
  }
  return [...map.values()]
    .sort((a, b) => a.major - b.major)
    .map((g) => {
      const newest = g.releases[0]?.version ?? "";
      const oldest = g.releases[g.releases.length - 1]?.version ?? "";
      const label = oldest && oldest !== newest ? `${oldest} - ${newest}` : newest;
      return { major: g.major, label, releases: g.releases };
    });
});

/** 更新说明条目：拍平成带全局连续编号的列表，用于美观的序号排版 */
const numberedSummary = computed(() => {
  let n = 0;
  return handwritten.value.summary.map((sec) => ({
    heading: sec.heading,
    bullets: sec.bullets.map((b) => ({ index: ++n, bullet: b })),
  }));
});

/** 自定义大标题分区：排除已结构化渲染的「更新说明 / 后续计划 / 下载」 */
const RESERVED_HEADINGS = new Set(["更新说明", "后续计划", "下载"]);
const customSections = computed(() =>
  handwritten.value.sections.filter((sec) => sec.heading && !RESERVED_HEADINGS.has(sec.heading)),
);

/** 右侧目录：更新说明 + 后续计划 + 下载 + 自定义分区 */
const tocItems = computed(() => {
  const items: { id: string; text: string }[] = [];
  if (handwritten.value.summary.length > 0) {
    items.push({ id: "summary", text: "更新说明" });
  }
  if (handwritten.value.plans.length > 0) {
    items.push({ id: "plans", text: "后续计划" });
  }
  if (handwritten.value.downloads.length > 0) {
    items.push({ id: "downloads", text: "下载" });
  }
  customSections.value.forEach((sec, si) => {
    if (sec.heading) items.push({ id: `section-${si}`, text: sec.heading });
  });
  return items;
});

/** 版本标题（后端 title 已为干净的「X.X.X 版本说明」） */
const releaseTitle = computed(() => {
  const title = currentRelease.value?.title || "";
  if (title) return title;
  return `${currentRelease.value?.version?.replace(/^v(?=\d)/, "") || ""} 版本说明`;
});

/** 翻页：当前版本在降序列表中的位置，上一页=更旧，下一页=更新 */
const currentIndex = computed(() =>
  releases.value.findIndex((r) => r.version === selectedTag.value),
);
const prevRelease = computed(() => releases.value[currentIndex.value + 1] ?? null);
const nextRelease = computed(() => releases.value[currentIndex.value - 1] ?? null);

const goPrev = () => {
  if (prevRelease.value) selectRelease(prevRelease.value.version);
};
const goNext = () => {
  if (nextRelease.value) selectRelease(nextRelease.value.version);
};

onMounted(() => {
  loadReleases();
});

/** 格式化日期（年月日） */
const formatDate = (date: string): string => {
  if (!date) return "";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return date;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

/** 滚动到指定分区 */
const scrollToHeading = async (id: string) => {
  await nextTick();
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
};
</script>

<style scoped>
.github-changelog {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.state-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary, #6b7280);
  padding: 40px;
}

.spinner {
  width: 24px;
  height: 24px;
  border: 3px solid var(--border-color, #e5e7eb);
  border-top-color: #0969da;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.retry-btn {
  padding: 6px 16px;
  border: 1px solid var(--border-color, #e5e7eb);
  background: var(--bg-secondary, #fff);
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-primary, #111827);
}

.retry-btn:hover {
  background: var(--bg-hover, #f3f4f6);
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

.version-group {
  margin-bottom: 16px;
}

.version-group:last-child {
  margin-bottom: 0;
}

.version-group-label {
  padding: 4px 8px;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary, #6b7280);
  letter-spacing: 0.3px;
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
  background: var(--bg-hover, #f3f4f6);
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
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary, #111827);
  text-align: center;
}

/* 导语 */
.release-intro {
  margin: 0 0 20px;
  font-size: 15px;
  line-height: 1.7;
  color: var(--text-primary, #111827);
}

/* 手写内容（更新说明 / 后续计划） */
.handwritten-section {
  margin-bottom: 16px;
}

.handwritten-section:last-child {
  margin-bottom: 0;
}

.handwritten-heading {
  margin: 12px 0 8px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.bullet-list {
  list-style: disc;
  padding-left: 20px;
  margin: 8px 0;
}

.bullet-item {
  margin: 6px 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-primary, #111827);
}

.section-paragraph {
  margin: 8px 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-primary, #111827);
}

/* 更新说明编号排版 */
.update-list {
  list-style: none;
  padding: 0;
  margin: 8px 0;
}

.update-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  border-bottom: 1px dashed var(--border-color, #e5e7eb);
}

.update-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.update-index {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: linear-gradient(135deg, #5d33f6, #8b5cf6);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  line-height: 26px;
  text-align: center;
  margin-top: 1px;
  font-family: "SF Mono", Monaco, "Cascadia Code", Consolas, monospace;
}

.update-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.update-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.update-desc {
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-secondary, #6b7280);
}

/* 分区 */
.category {
  margin-bottom: 28px;
}

.category-title {
  margin: 0 0 14px;
  padding-bottom: 8px;
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary, #111827);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}

/* 下载 */
.download-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
}

.download-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.download-table th,
.download-table td {
  border: 1px solid var(--border-color, #e5e7eb);
  padding: 8px 12px;
  text-align: left;
  color: var(--text-primary, #111827);
}

.download-table th {
  background: var(--bg-secondary, #fafafa);
  font-weight: 600;
  color: var(--text-primary, #111827);
}

.download-table a {
  color: var(--color-brand, #0969da);
  text-decoration: none;
  word-break: break-all;
}

.download-table a:hover {
  text-decoration: underline;
}

.download-thanks {
  margin: 16px 0 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #111827);
  text-align: center;
}

/* 翻页 */
.release-pager {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 28px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color, #e5e7eb);
}

.pager-link {
  color: #5d33f6;
  font-size: 14px;
  cursor: pointer;
  text-decoration: none;
}

.pager-link:hover {
  text-decoration: underline;
}

.pager-next {
  text-align: right;
}

.pager-placeholder {
  flex: 1;
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
  transition:
    color 0.2s,
    background 0.2s;
  line-height: 1.4;
}

.toc-item:hover {
  color: #5d33f6;
  background: var(--bg-hover, #f3f4f6);
}

.toc-empty {
  font-size: 13px;
  color: var(--text-secondary, #9ca3af);
  padding: 0 8px;
}
</style>
