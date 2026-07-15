<template>
  <div class="map-tools">
    <button class="tool-btn" @click="$emit('zoomOut')" title="缩小">−</button>
    <span class="zoom-label">{{ Math.round(state.zoom * 100) }}%</span>
    <button class="tool-btn" @click="$emit('zoomIn')" title="放大">+</button>
    <span class="sep" />
    <button class="tool-btn" @click="$emit('resetView')" title="重置视图">⟲</button>
    <span class="sep" />
    <button
      class="tool-btn"
      :class="{ active: state.selectionMode }"
      @click="invokeAction('toggleSelectionMode')"
      title="框选节点"
    >□</button>
    <button class="tool-btn" @click="invokeAction('copyMap')" title="复制地图">📋</button>
  </div>
</template>

<script setup lang="ts">
import { state, invokeAction } from '@core/capability-map'

defineEmits<{
  zoomIn: []
  zoomOut: []
  resetView: []
}>()
</script>

<style scoped>
.map-tools {
  position: absolute; top: 0.4rem; right: 0.5rem;
  display: flex; align-items: center; gap: 0.3rem;
  pointer-events: none;
  z-index: 5;
}
.zoom-label {
  font-size: 0.75rem; min-width: 3em; text-align: center;
  color: var(--vscode-descriptionForeground);
}
.tool-btn {
  pointer-events: auto;
  cursor: pointer; border: 1px solid var(--vscode-panel-border);
  border-radius: 4px;
  background: var(--vscode-sideBar-background);
  color: var(--vscode-editor-foreground);
  font-size: 0.85rem;
  padding: 0.2rem 0.6rem;
  transition: background 0.15s;
}
.tool-btn:hover {
  background: var(--vscode-button-hoverBackground);
  color: var(--vscode-button-foreground);
}
.tool-btn.active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  box-shadow: 0 0 0 1px var(--vscode-focusBorder);
}
.sep { width: 1px; height: 1.2em; background: var(--vscode-panel-border); }
</style>
