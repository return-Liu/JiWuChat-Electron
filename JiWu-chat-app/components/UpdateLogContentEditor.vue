<template>
  <div class="content-editor">
    <!-- 分块列表 -->
    <div class="block-list">
      <div v-for="(block, index) in blocks" :key="block.id" class="editor-block">
        <div class="block-head">
          <input
            v-model="block.heading"
            class="block-heading-input"
            :placeholder="index === 0 ? '大标题（可选，如：更新说明）' : '大标题'"
            @input="emitChange"
          />
          <div class="block-actions">
            <button
              class="icon-btn"
              title="上移"
              :disabled="index === 0"
              @click="moveBlock(index, -1)"
            >
              ↑
            </button>
            <button
              class="icon-btn"
              title="下移"
              :disabled="index === blocks.length - 1"
              @click="moveBlock(index, 1)"
            >
              ↓
            </button>
            <button
              class="icon-btn danger"
              title="删除此块"
              :disabled="blocks.length === 1"
              @click="removeBlock(index)"
            >
              ×
            </button>
          </div>
        </div>

        <textarea
          v-model="block.body"
          class="block-body-input"
          rows="5"
          :placeholder="bodyPlaceholder"
          @input="emitChange"
        ></textarea>
      </div>
    </div>

    <!-- 操作栏 -->
    <div class="editor-toolbar">
      <button class="add-block-btn" @click="addBlock">+ 添加内容块</button>
      <span class="block-count">共 {{ blocks.length }} 块</span>
    </div>

    <!-- 实时预览 -->
    <div class="editor-preview">
      <div class="preview-label">预览</div>
      <div class="preview-body" v-html="previewHtml"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { renderUpdateLogMarkdown } from "../untils/markdownRenderer";

interface ContentBlock {
  id: number;
  heading: string;
  body: string;
}

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

let uid = 0;
const nextId = () => ++uid;

/** 将 Markdown 文本解析为内容块（以 ## 大标题切分） */
function parseToBlocks(markdown: string): ContentBlock[] {
  const text = (markdown || "").replace(/\r\n/g, "\n").trim();
  if (!text) {
    return [{ id: nextId(), heading: "", body: "" }];
  }

  const lines = text.split("\n");
  const result: ContentBlock[] = [];
  let current: ContentBlock | null = null;

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      current = { id: nextId(), heading: h2[1].trim(), body: "" };
      result.push(current);
      continue;
    }
    if (!current) {
      // 大标题之前的内容（导语）
      current = { id: nextId(), heading: "", body: "" };
      result.push(current);
    }
    current.body += (current.body ? "\n" : "") + line;
  }

  // 清理每块正文首尾空行
  result.forEach((b) => {
    b.body = b.body.replace(/^\n+|\n+$/g, "");
  });

  return result.length ? result : [{ id: nextId(), heading: "", body: "" }];
}

/** 将内容块序列化为 Markdown */
function serializeBlocks(list: ContentBlock[]): string {
  const parts: string[] = [];
  for (const block of list) {
    const heading = block.heading.trim();
    const body = block.body.replace(/^\n+|\n+$/g, "");
    if (!heading && !body) continue;
    if (heading) parts.push(`## ${heading}`);
    if (body) parts.push(body);
  }
  return parts.join("\n\n");
}

const blocks = ref<ContentBlock[]>(parseToBlocks(props.modelValue));

// 外部值变化时（如切换编辑对象）重新解析
watch(
  () => props.modelValue,
  (val) => {
    if (serializeBlocks(blocks.value) !== (val || "").trim()) {
      blocks.value = parseToBlocks(val);
    }
  },
);

const emitChange = () => {
  emit("update:modelValue", serializeBlocks(blocks.value));
};

const addBlock = () => {
  blocks.value.push({ id: nextId(), heading: "", body: "" });
  emitChange();
};

const removeBlock = (index: number) => {
  if (blocks.value.length <= 1) return;
  blocks.value.splice(index, 1);
  emitChange();
};

const moveBlock = (index: number, delta: number) => {
  const target = index + delta;
  if (target < 0 || target >= blocks.value.length) return;
  const [item] = blocks.value.splice(index, 1);
  blocks.value.splice(target, 0, item);
  emitChange();
};

const bodyPlaceholder = "支持 Markdown：- 列表、**加粗**、`代码`，以及 #PC客户端 / #安卓版 分栏";

const previewHtml = computed(() => renderUpdateLogMarkdown(serializeBlocks(blocks.value)));
</script>

<style lang="scss" scoped>
.content-editor {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.block-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.editor-block {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 10px;
  background: var(--bg-secondary, var(--bg-tertiary));
}

.block-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.block-heading-input {
  flex: 1;
  padding: 7px 10px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  background: var(--bg-primary);
  color: var(--text-primary);
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: var(--purple-color);
  }
}

.block-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.icon-btn {
  width: 26px;
  height: 26px;
  border: 1px solid var(--border-color);
  border-radius: 5px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: var(--bg-hover);
    color: var(--text-primary);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  &.danger:hover:not(:disabled) {
    color: var(--error-color, #ef4444);
    border-color: var(--error-color, #ef4444);
  }
}

.block-body-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.6;
  background: var(--bg-primary);
  color: var(--text-primary);
  resize: vertical;
  min-height: 96px;
  font-family: inherit;
  transition: border-color 0.2s;

  &:focus {
    outline: none;
    border-color: var(--purple-color);
  }
}

.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.add-block-btn {
  padding: 7px 14px;
  border: 1px dashed var(--purple-color);
  border-radius: 6px;
  background: transparent;
  color: var(--purple-color);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: var(--bg-hover);
  }
}

.block-count {
  font-size: 12px;
  color: var(--text-tertiary);
}

.editor-preview {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  overflow: hidden;
}

.preview-label {
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-color);
}

.preview-body {
  padding: 12px;
  max-height: 260px;
  overflow-y: auto;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-primary);

  :deep(h1),
  :deep(h2),
  :deep(h3),
  :deep(h4) {
    margin: 12px 0 6px;
    font-weight: 700;
    color: var(--text-primary);
  }

  :deep(h1) {
    font-size: 18px;
  }

  :deep(h2) {
    font-size: 16px;
  }

  :deep(h3) {
    font-size: 14px;
  }

  :deep(ul) {
    padding-left: 20px;
    margin: 6px 0;
  }

  :deep(li) {
    margin: 4px 0;
  }

  :deep(.platform-block) {
    margin: 8px 0;
    padding: 8px 10px;
    border-left: 3px solid var(--purple-color);
    background: var(--bg-tertiary);
    border-radius: 4px;
  }

  :deep(code) {
    padding: 1px 5px;
    border-radius: 4px;
    background: var(--bg-tertiary);
    font-family: "SF Mono", Monaco, Consolas, monospace;
    font-size: 12px;
  }
}
</style>
