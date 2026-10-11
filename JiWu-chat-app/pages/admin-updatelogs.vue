<template>
  <div
    class="admin-updatelogs"
    :class="{ 'has-dynamic-bg': hasDynamicBackground }"
    :style="dynamicThemeStyle"
  >
    <DynamicBackground />

    <!-- 全局侧边栏导航（与设置中心保持一致） -->
    <Sidebar :current-area="'settings'" />

    <!-- 内容 -->
    <div class="admin-main">
      <header class="admin-header">
        <div>
          <h1>更新日志管理</h1>
          <p class="subtitle">管理各版本的 Markdown 说明内容</p>
        </div>
        <button class="create-btn" @click="openCreate">+ 新增日志</button>
      </header>

      <!-- 权限提示 -->
      <div v-if="!isAdmin" class="state-box">
        <p>仅管理员可访问此页面</p>
      </div>

      <!-- 加载状态 -->
      <div v-else-if="loading" class="state-box">
        <span class="spinner"></span>
        <span>加载中...</span>
      </div>

      <!-- 空状态 -->
      <div v-else-if="logs.length === 0" class="state-box">
        <p>暂无更新日志</p>
      </div>

      <!-- 列表 -->
      <table v-else class="log-table">
        <thead>
          <tr>
            <th>版本</th>
            <th>标题</th>
            <th>发布日期</th>
            <th class="col-actions">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in logs" :key="log.id">
            <td class="mono">{{ log.version }}</td>
            <td>{{ log.title }}</td>
            <td>{{ formatDate(log.releaseDate) }}</td>
            <td class="actions">
              <a class="edit" @click="openEdit(log)">编辑</a>
              <a class="danger" @click="remove(log)">删除</a>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- 编辑弹窗 -->
    <UpdateLogModal
      :visible="modalVisible"
      :editing-log="editingLog"
      @success="onSuccess"
      @update:visible="modalVisible = $event"
      @cancel="modalVisible = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { Modal } from "ant-design-vue";
import request from "../untils/request";
import { useUserStore } from "../stores/user";
import { useDynamicBackground } from "../composables/useDynamicBackground";
import { useDynamicThemeVars } from "../composables/useDynamicThemeVars";
import UpdateLogModal from "../components/UpdateLogModal.vue";

const userStore = useUserStore();

// 动态主题：动态壁纸背景 + 半透明面板
const { hasDynamicBackground } = useDynamicBackground();
const { dynamicThemeStyle } = useDynamicThemeVars("dark");

const logs = ref<any[]>([]);
const loading = ref(false);
const modalVisible = ref(false);
const editingLog = ref<any>(null);

const isAdmin = computed(() => userStore.userId === 1);

async function fetchLogs() {
  loading.value = true;
  try {
    const res: any = await request.get("/updatelogs");
    logs.value = res?.data?.logs || res?.logs || (Array.isArray(res) ? res : []);
  } catch {
    logs.value = [];
  } finally {
    loading.value = false;
  }
}

function openCreate() {
  editingLog.value = null;
  modalVisible.value = true;
}

function openEdit(log: any) {
  editingLog.value = log;
  modalVisible.value = true;
}

function remove(log: any) {
  Modal.confirm({
    title: `确认删除 ${log.version}？`,
    content: "删除后不可恢复",
    okText: "删除",
    okType: "danger",
    cancelText: "取消",
    onOk: async () => {
      await request.delete(`/updatelogs/${log.id}`);
      fetchLogs();
    },
  });
}

function onSuccess() {
  modalVisible.value = false;
  fetchLogs();
}

function formatDate(d?: string) {
  if (!d) return "";
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate(),
  ).padStart(2, "0")}`;
}

onMounted(() => {
  if (isAdmin.value) fetchLogs();
});
</script>

<style scoped>
.admin-updatelogs {
  position: relative;
  width: 100vw;
  height: 100vh;
  background: var(--bg-primary);
  display: flex;
  overflow: hidden;

  &.has-dynamic-bg > :not(.dynamic-bg-layer) {
    position: relative;
    z-index: 1;
  }

  &.has-dynamic-bg .qq-sidebar {
    z-index: 2;
  }

  /* ===== 内容区 ===== */
  .admin-main {
    flex: 1;
    overflow-y: auto;
    min-width: 0;
    padding: 32px;
    box-sizing: border-box;
  }
}

.admin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.admin-header h1 {
  margin: 0 0 4px;
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}

.subtitle {
  margin: 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.create-btn {
  padding: 8px 18px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #5d33f6, #8b5cf6);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.create-btn:hover {
  opacity: 0.88;
}

.state-box {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 60px;
  color: var(--text-secondary);
  font-size: 14px;
}

.spinner {
  width: 22px;
  height: 22px;
  border: 3px solid var(--border-color);
  border-top-color: #5d33f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.log-table {
  width: 100%;
  border-collapse: collapse;
  background: var(--card-bg);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  overflow: hidden;
}

.log-table th,
.log-table td {
  padding: 14px 16px;
  text-align: left;
  font-size: 14px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-color);
}

.log-table th {
  background: var(--bg-secondary);
  font-weight: 600;
}

.log-table tbody tr:last-child td {
  border-bottom: none;
}

.log-table tbody tr:hover {
  background: var(--bg-hover);
}

.mono {
  font-family: "SF Mono", Monaco, "Cascadia Code", Consolas, monospace;
  font-weight: 600;
}

.col-actions {
  width: 140px;
}

.actions {
  display: flex;
  gap: 16px;
}

.actions a {
  font-size: 13px;
  cursor: pointer;
}

.edit {
  color: var(--purple-color, #5d33f6);
}

.danger {
  color: var(--error-color, #ef4444);
}

.edit:hover,
.danger:hover {
  text-decoration: underline;
}
</style>
