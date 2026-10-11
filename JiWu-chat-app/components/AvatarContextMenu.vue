<template>
  <Teleport to="body">
    <Transition name="avatar-menu-fade">
      <div
        v-if="visible"
        ref="menuRef"
        class="avatar-context-menu"
        :class="{ 'is-dark': isDark }"
        :style="{ top: resolvedPosition.y + 'px', left: resolvedPosition.x + 'px' }"
        role="menu"
        @contextmenu.prevent
        @click.stop
      >
        <!-- @Ta：仅他人显示，自己不需要 @ 自己 -->
        <div
          v-if="!isSelf"
          class="avatar-menu-item tone-purple"
          role="menuitem"
          @click.stop="handleMention"
        >
          <span class="menu-icon-wrap">
            <i class="iconfont icon-aite"></i>
          </span>
          <span class="menu-label">{{ displayName }}</span>
        </div>

        <div v-if="!isSelf" class="avatar-menu-divider"></div>

        <!-- 个人资料 / 查看自己 -->
        <div class="avatar-menu-item tone-blue" role="menuitem" @click.stop="handleViewProfile">
          <span class="menu-icon-wrap">
            <i class="iconfont icon-Profile1"></i>
          </span>
          <span class="menu-label">{{ isSelf ? "查看自己" : "个人资料" }}</span>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onUnmounted, computed } from "vue";
import { useSiderColor } from "../stores/siderColor";

interface Props {
  visible: boolean;
  position: { x: number; y: number };
  /** 用于 @Ta 的展示名（群昵称优先） */
  displayName: string;
  /** 是否为当前登录用户自己 */
  isSelf: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "close"): void;
  (e: "mention"): void;
  (e: "viewProfile"): void;
}>();

const siderColorStore = useSiderColor();
const isDark = computed(() => !!siderColorStore.systemPrefersDark);

const menuRef = ref<HTMLElement | null>(null);
const resolvedPosition = ref({ x: 0, y: 0 });

const clampPosition = () => {
  const el = menuRef.value;
  if (!el) return;

  const { x, y } = props.position;
  const margin = 8;
  const { width, height } = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = x;
  let top = y;
  if (left + width + margin > vw) left = Math.max(margin, x - width);
  if (top + height + margin > vh) top = Math.max(margin, y - height);

  resolvedPosition.value = {
    x: Math.max(margin, Math.min(left, vw - width - margin)),
    y: Math.max(margin, Math.min(top, vh - height - margin)),
  };
};

const handleMention = () => {
  emit("mention");
  emit("close");
};

const handleViewProfile = () => {
  emit("viewProfile");
  emit("close");
};

const handleClickOutside = (event: MouseEvent) => {
  const target = event.target as HTMLElement | null;
  if (target?.closest(".avatar-context-menu")) return;
  emit("close");
};

watch(
  () => [props.visible, props.position],
  () => {
    if (!props.visible) return;
    resolvedPosition.value = { x: props.position.x, y: props.position.y };
    nextTick(clampPosition);
  },
  { immediate: true },
);

watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      nextTick(() => document.addEventListener("click", handleClickOutside));
    } else {
      document.removeEventListener("click", handleClickOutside);
    }
  },
  { immediate: true },
);

onUnmounted(() => {
  document.removeEventListener("click", handleClickOutside);
});
</script>

<style lang="scss" scoped>
/* ============================================================
   头像菜单 · iconfont 图标版
   ============================================================ */

.avatar-context-menu {
  position: fixed;
  z-index: 10000;
  min-width: 168px;
  padding: 4px;
  border-radius: 10px;
  background: var(--dt-panel-solid, var(--card-bg));
  border: 1px solid rgba(5, 5, 5, 0.06);
  box-shadow:
    0 6px 16px 0 rgba(0, 0, 0, 0.08),
    0 3px 6px -4px rgba(0, 0, 0, 0.12),
    0 9px 28px 8px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  font-family:
    -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans",
    sans-serif;
}

.avatar-context-menu.is-dark {
  background: #1f1f1f;
  border-color: #303030;
  box-shadow:
    0 6px 16px 0 rgba(0, 0, 0, 0.32),
    0 3px 6px -4px rgba(0, 0, 0, 0.48),
    0 9px 28px 8px rgba(0, 0, 0, 0.2);
}

/* 菜单项 */
.avatar-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  height: 34px;
  padding: 0 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.5714;
  color: rgba(0, 0, 0, 0.88);
  user-select: none;
  transition: background 0.2s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.04);
  }

  &:active {
    background: rgba(0, 0, 0, 0.06);
  }
}

.is-dark .avatar-menu-item {
  color: rgba(255, 255, 255, 0.88);

  &:hover {
    background: rgba(255, 255, 255, 0.08);
  }

  &:active {
    background: rgba(255, 255, 255, 0.12);
  }
}

/* iconfont 图标容器 */
.menu-icon-wrap {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  color: inherit;

  .iconfont {
    font-size: 18px;
    line-height: 1;
    display: block;
    transition: transform 0.2s ease;
  }
}

/* 悬停时图标轻微放大 */
.avatar-menu-item:hover .menu-icon-wrap .iconfont {
  transform: scale(1.08);
}

.is-dark .menu-icon-wrap {
  color: rgba(255, 255, 255, 0.65);
}

.menu-label {
  flex: 1;
  white-space: nowrap;
}

/* @Ta 主色强调 */
.tone-purple .menu-icon-wrap,
.tone-purple .menu-label {
  color: #1677ff;
}

.is-dark .tone-purple .menu-icon-wrap,
.is-dark .tone-purple .menu-label {
  color: #3c89e8;
}

/* 个人资料中性色 */
.tone-blue .menu-icon-wrap {
  color: rgba(0, 0, 0, 0.65);
}

.tone-blue .menu-label {
  color: rgba(0, 0, 0, 0.88);
}

.is-dark .tone-blue .menu-icon-wrap {
  color: rgba(255, 255, 255, 0.65);
}

.is-dark .tone-blue .menu-label {
  color: rgba(255, 255, 255, 0.88);
}

/* 分隔线 */
.avatar-menu-divider {
  height: 1px;
  background: rgba(5, 5, 5, 0.06);
  margin: 4px 8px;
}

.is-dark .avatar-menu-divider {
  background: rgba(253, 253, 253, 0.12);
}

/* 弹出动画 */
.avatar-menu-fade-enter-active {
  transition:
    opacity 0.2s cubic-bezier(0.645, 0.045, 0.355, 1),
    transform 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);
}

.avatar-menu-fade-leave-active {
  transition:
    opacity 0.15s cubic-bezier(0.645, 0.045, 0.355, 1),
    transform 0.15s cubic-bezier(0.645, 0.045, 0.355, 1);
}

.avatar-menu-fade-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.avatar-menu-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}
</style>
