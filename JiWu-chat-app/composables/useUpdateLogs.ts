import { ref, computed } from "vue";
import request from "../untils/request";
import {
  extractHandwrittenContent,
  type HandwrittenContent,
} from "../untils/changelogParser";

/** 后端 /updatelogs 返回的更新日志条目 */
export interface UpdateLogEntry {
  id: number;
  version: string;
  title: string;
  summary: string | null;
  content: string;
  updateType: string;
  tagColor: string;
  isImportant: boolean;
  releaseDate: string | null;
  coverImage: string | null;
  changelog: string | null;
  platform: string;
  createdAt: string;
  updatedAt: string;
  formattedTime?: string;
}

/** 语义化版本号比较（降序） */
function compareVersionsDesc(a: string, b: string): number {
  const pa = a.replace(/^v/, "").split(".").map(Number);
  const pb = b.replace(/^v/, "").split(".").map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na !== nb) return nb - na;
  }
  return 0;
}

/** 兼容多种响应结构，安全取出日志列表 */
function extractLogs(res: any): UpdateLogEntry[] {
  if (res?.data?.logs && Array.isArray(res.data.logs)) return res.data.logs;
  if (res?.logs && Array.isArray(res.logs)) return res.logs;
  if (Array.isArray(res)) return res;
  if (res?.data && Array.isArray(res.data)) return res.data;
  return [];
}

/**
 * 更新日志数据源：统一从后端 /updatelogs 拉取。
 * 替代原先的 GitHub API 数据源，前端展示统一走这里。
 * @param initialVersion 初始版本号（来自路由参数，可选）
 */
export function useUpdateLogs(initialVersion?: string) {
  const logs = ref<UpdateLogEntry[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const selectedVersion = ref(initialVersion || "");

  /** 按版本号降序排列 */
  const sortedLogs = computed(() => {
    return [...logs.value].sort((a, b) => compareVersionsDesc(a.version, b.version));
  });

  /** 当前选中的版本（默认最新） */
  const currentLog = computed(() => {
    return (
      sortedLogs.value.find((l) => l.version === selectedVersion.value) ||
      sortedLogs.value[0] ||
      null
    );
  });

  /** 从 content(md) 提取结构化内容（导语 / 更新说明 / 后续计划 / 下载） */
  const handwritten = computed<HandwrittenContent>(() => {
    const content = currentLog.value?.content || "";
    return content
      ? extractHandwrittenContent(content)
      : ({ intro: "", summary: [], plans: [], downloads: [], sections: [] } as HandwrittenContent);
  });

  /** 加载全部更新日志 */
  const load = async () => {
    loading.value = true;
    error.value = null;
    try {
      const res: any = await request.get("/updatelogs");
      const list = extractLogs(res);
      logs.value = list;
      const sorted = [...list].sort((a, b) => compareVersionsDesc(a.version, b.version));
      // 优先用初始版本号（路由参数），其次用当前选中，最后用最新版本
      if (initialVersion && list.some((l) => l.version === initialVersion)) {
        selectedVersion.value = initialVersion;
      } else if (!selectedVersion.value && sorted.length > 0) {
        selectedVersion.value = sorted[0].version;
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : "加载更新日志失败";
    } finally {
      loading.value = false;
    }
  };

  /** 切换版本 */
  const selectVersion = (version: string) => {
    if (selectedVersion.value === version) return;
    selectedVersion.value = version;
  };

  return {
    logs,
    sortedLogs,
    loading,
    error,
    selectedVersion,
    currentLog,
    handwritten,
    load,
    selectVersion,
  };
}
