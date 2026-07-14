# App.vue 当前实际内容

App.vue 只做根组件分发 + 全局样式地基，不写任何业务逻辑。

```vue
<template>
  <CapabilityMap />
</template>

<script setup lang="ts">
import CapabilityMap from './pages/capability-map/CapabilityMap.vue'
</script>

<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body, #app { height: 100%; overflow: hidden; }
body {
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size, 0.85rem);
  background: var(--vscode-editor-background);
  color: var(--vscode-editor-foreground);
}
</style>
```

所有运行时职责（生命周期、渲染调度、ResizeObserver）下放到 `pages/capability-map/CapabilityMap.vue` + `composable.ts`。
