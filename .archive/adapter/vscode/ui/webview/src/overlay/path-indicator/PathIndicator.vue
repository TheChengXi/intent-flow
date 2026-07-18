<template>
  <div v-if="state.currentFolder" class="path-indicator" :title="state.currentFolder">
    <span class="path-label">{{ state.currentFolder }}</span>
  </div>
</template>

<script setup lang="ts">
import { state } from '@core/capability-map'
</script>

<style scoped>
.path-indicator {
  position: absolute;
  top: 0.4rem;
  left: 0.5rem;
  z-index: 5;
  pointer-events: none;
  max-width: 50%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.path-label {
  font-size: 0.75rem;
  color: var(--vscode-descriptionForeground);
}
</style>
