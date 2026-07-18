<template>
  <div v-if="visible" class="info-overlay" @click.self="close">
    <aside class="info-panel">
      <header class="info-header">
        <span class="info-title">{{ text.title }}</span>
        <button class="info-close" @click="close">{{ text.closeBtn }}</button>
      </header>
      <div class="info-file">{{ file }}</div>
      <div class="info-label">{{ text.intentLabel }}</div>
      <div class="info-intent">{{ intent || '(无 @intent)' }}</div>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { text } from '@resource/text/info-panel'

defineProps<{
  visible: boolean
  file: string
  intent: string
  close: () => void
}>()
</script>

<style scoped>
.info-overlay {
  position: absolute; inset: 0; z-index: 10;
  background: rgba(0,0,0,0.1);
}
.info-panel {
  position: absolute; top: 0; right: 0; bottom: 0;
  width: 35%; min-width: 200px;
  background: var(--vscode-sideBar-background);
  border-left: 1px solid var(--vscode-panel-border);
  padding: 0.75rem 0.75rem;
  display: flex; flex-direction: column; gap: 0.5rem;
}
.info-header {
  display: flex; justify-content: space-between; align-items: center;
}
.info-title { font-size: 0.95rem; font-weight: bold; }
.info-close {
  cursor: pointer; border: none; background: none;
  font-size: 1rem; color: inherit; padding: 0.2rem 0.4rem;
}
.info-close:hover { opacity: 0.7; }
.info-file {
  font-size: 0.85rem;
  color: var(--vscode-textLink-foreground);
  word-break: break-all;
}
.info-label { font-size: 0.8rem; color: var(--vscode-descriptionForeground); }
.info-intent {
  font-size: 0.9rem;
  word-break: break-all;
}
</style>
