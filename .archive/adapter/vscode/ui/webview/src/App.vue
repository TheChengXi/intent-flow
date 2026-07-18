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
