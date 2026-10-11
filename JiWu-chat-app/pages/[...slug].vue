<script setup lang="ts">
// 官网 history 路由兜底：未匹配的路径（如 /docs/start.html、/pricing.html、
// /versions/v2.0.2.html）直接渲染首页，首页会根据 pathname 恢复对应 tab 并同步版本号。
import HomeIndex from "./index.vue";
</script>

<template>
  <HomeIndex />
</template>
