<template>
  <Teleport to="body">
    <transition name="sf-fade">
      <div v-if="visible" class="sf-overlay" @click.self="close">
        <div class="sf-card">
          <div class="sf-header">
            <h3 class="sf-title">选择分享好友</h3>
            <button class="sf-close" type="button" @click="close">✕</button>
          </div>

          <div class="sf-body">
            <div v-if="loading" class="sf-state">加载中...</div>
            <div v-else-if="friends.length === 0" class="sf-state">暂无好友可分享</div>
            <div v-else class="sf-list">
              <div
                v-for="friend in friends"
                :key="friend.id"
                class="sf-item"
                :class="{ selected: selectedId === friend.id }"
                @click="selectedId = friend.id"
              >
                <img :src="friend.avatar" class="sf-avatar" alt="" />
                <span class="sf-name">{{ friend.displayName || friend.name || "好友" }}</span>
                <i v-if="selectedId === friend.id" class="sf-check">✓</i>
              </div>
            </div>
          </div>

          <div class="sf-footer">
            <button class="sf-cancel" type="button" @click="close">取消</button>
            <button
              class="sf-confirm"
              type="button"
              :disabled="!selectedId || sending"
              @click="confirm"
            >
              {{ sending ? "发送中..." : "分享" }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { message } from "ant-design-vue";
import request from "../untils/request";
import { getFriends } from "../untils/friendManager";

interface Props {
  visible: boolean;
  shareType: "user" | "group";
  targetId: string | number;
}

const props = defineProps<Props>();
const emit = defineEmits<{ "update:visible": [value: boolean]; success: [] }>();

const friends = ref<any[]>([]);
const loading = ref(false);
const selectedId = ref<number | null>(null);
const sending = ref(false);

watch(
  () => props.visible,
  async (v) => {
    if (v) {
      selectedId.value = null;
      loading.value = true;
      try {
        friends.value = await getFriends("accepted");
      } catch {
        friends.value = [];
      } finally {
        loading.value = false;
      }
    }
  },
);

const close = () => emit("update:visible", false);

const confirm = async () => {
  if (!selectedId.value) return;
  sending.value = true;
  try {
    await request.post("/share/send", {
      type: props.shareType,
      targetId: props.targetId,
      receiverId: selectedId.value,
    });
    message.success("分享成功");
    close();
    emit("success");
  } catch (err: any) {
    message.error(err?.response?.data?.data?.message || "分享失败");
  } finally {
    sending.value = false;
  }
};
</script>

<style scoped>
.sf-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 3000;
}

.sf-card {
  width: 90%;
  max-width: 380px;
  max-height: 80vh;
  background: #fff;
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sf-header {
  padding: 14px 18px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.sf-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
}

.sf-close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  border-radius: 50%;
  cursor: pointer;
  font-size: 14px;
  color: #999;
}

.sf-close:hover {
  background: #f5f5f5;
}

.sf-body {
  flex: 1;
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
  padding: 8px;
}

.sf-state {
  padding: 40px 0;
  text-align: center;
  color: #999;
  font-size: 13px;
}

.sf-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sf-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.sf-item:hover {
  background: #f5f7fa;
}

.sf-item.selected {
  background: rgba(22, 93, 255, 0.08);
}

.sf-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  background: #eee;
  flex-shrink: 0;
}

.sf-name {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sf-check {
  color: #165dff;
  font-style: normal;
  font-weight: bold;
}

.sf-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid #eee;
  flex-shrink: 0;
}

.sf-cancel {
  padding: 8px 18px;
  border: 1px solid #e0e0e0;
  background: #fff;
  border-radius: 8px;
  color: #666;
  font-size: 13px;
  cursor: pointer;
}

.sf-confirm {
  padding: 8px 22px;
  border: none;
  background: #165dff;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  cursor: pointer;
}

.sf-confirm:disabled {
  background: #a8c4ff;
  cursor: not-allowed;
}

.sf-fade-enter-active,
.sf-fade-leave-active {
  transition: opacity 0.2s ease;
}

.sf-fade-enter-from,
.sf-fade-leave-to {
  opacity: 0;
}
</style>
