<template>
  <a-modal
    :open="visible"
    :footer="null"
    :width="420"
    centered
    :closable="false"
    class="group-risk-modal"
    @cancel="close"
  >
    <div class="risk-modal-body">
      <div class="risk-modal-icon" :class="levelClass">
        <WarningFilled />
      </div>
      <h3 class="risk-modal-title">群聊安全提醒</h3>
      <p class="risk-modal-subtitle">「{{ groupName }}」{{ levelText }}</p>

      <div class="risk-modal-stats">
        <div class="risk-stat">
          <span class="risk-stat-value">{{ reportCount }}</span>
          <span class="risk-stat-label">近 30 天被举报</span>
        </div>
      </div>

      <div v-if="reasons.length" class="risk-modal-reasons">
        <div class="risk-reasons-title">主要涉及</div>
        <div class="risk-reasons-list">
          <span v-for="reason in reasons" :key="reason" class="risk-reason-tag">
            {{ reason }}
          </span>
        </div>
      </div>

      <div class="risk-modal-tips">
        <div class="risk-tips-title">安全建议</div>
        <ul>
          <li>谨慎添加群内陌生人为好友</li>
          <li>不点击不明链接、不扫描陌生二维码</li>
          <li>涉及转账、汇款时务必核实身份</li>
        </ul>
      </div>

      <div class="risk-modal-actions">
        <button class="risk-btn-primary" type="button" @click="close">我已知晓</button>
      </div>
    </div>
  </a-modal>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { WarningFilled } from "@ant-design/icons-vue";

interface Props {
  visible: boolean;
  groupName?: string;
  riskLevel?: "normal" | "watch" | "warning" | "high" | "severe";
  reportCount?: number;
  reasons?: string[];
}

const props = withDefaults(defineProps<Props>(), {
  groupName: "",
  riskLevel: "normal",
  reportCount: 0,
  reasons: () => [],
});

const emit = defineEmits<{
  "update:visible": [value: boolean];
}>();

const levelClass = computed(() => `level-${props.riskLevel || "normal"}`);

const levelText = computed(() => {
  switch (props.riskLevel) {
    case "severe":
      return "存在严重安全风险";
    case "high":
      return "存在较高安全风险";
    case "warning":
      return "近期收到多次举报";
    case "watch":
      return "近期收到举报";
    default:
      return "暂时未发现风险";
  }
});

const close = () => {
  emit("update:visible", false);
};
</script>

<style scoped lang="scss">
.risk-modal-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px 4px;
  text-align: center;
}

.risk-modal-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  margin-bottom: 14px;
  color: #fff;
  background: var(--warning-color, #f59e0b);

  &.level-watch {
    background: #f59e0b;
  }
  &.level-warning {
    background: #f97316;
  }
  &.level-high {
    background: #ef4444;
  }
  &.level-severe {
    background: #dc2626;
  }
}

.risk-modal-title {
  margin: 0 0 6px;
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary, #1a1a2e);
}

.risk-modal-subtitle {
  margin: 0 0 18px;
  font-size: 13px;
  color: var(--text-secondary, #6b7280);
}

.risk-modal-stats {
  width: 100%;
  margin-bottom: 16px;

  .risk-stat {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 12px;
    border-radius: 10px;
    background: rgba(245, 158, 11, 0.08);
  }

  .risk-stat-value {
    font-size: 24px;
    font-weight: 700;
    line-height: 1;
    color: #f97316;
  }

  .risk-stat-label {
    font-size: 12px;
    color: var(--text-secondary, #6b7280);
  }
}

.risk-modal-reasons {
  width: 100%;
  margin-bottom: 16px;
  text-align: left;

  .risk-reasons-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-secondary, #6b7280);
    margin-bottom: 8px;
  }

  .risk-reasons-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .risk-reason-tag {
    padding: 3px 10px;
    font-size: 12px;
    border-radius: 999px;
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }
}

.risk-modal-tips {
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--bg-primary, #f5f6fa);
  text-align: left;

  .risk-tips-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-primary, #1a1a2e);
    margin-bottom: 6px;
  }

  ul {
    margin: 0;
    padding-left: 18px;

    li {
      font-size: 12.5px;
      line-height: 1.8;
      color: var(--text-secondary, #6b7280);
    }
  }
}

.risk-modal-actions {
  width: 100%;
  margin-top: 20px;

  .risk-btn-primary {
    width: 100%;
    height: 38px;
    font-size: 14px;
    font-weight: 500;
    color: #fff;
    background: var(--color-primary, #6366f1);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: filter 0.2s;

    &:hover {
      filter: brightness(1.06);
    }
  }
}
</style>
