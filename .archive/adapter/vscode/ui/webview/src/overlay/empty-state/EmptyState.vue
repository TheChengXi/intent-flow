<template>
  <div class="empty-state">
    <div class="empty-icon">{{ text.icon }}</div>
    <div class="empty-title">{{ text.title }}</div>
    <div class="empty-desc">{{ text.description }}</div>
    <button class="empty-btn" @click="invokeAction('selectFolder')">
      {{ text.selectBtn }}
    </button>
    <div class="empty-legend">
      <span v-for="item in text.legend" :key="item.label" class="legend-item">
        <span class="legend-dot" :style="dotStyle(item)" />
        {{ item.label }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { text } from '@resource/text/empty-state'

defineProps<{ invokeAction: (name: string, payload?: any) => void }>()

function dotStyle(item: { label: string; color: string; radius: number }) {
  return { background: item.color, borderRadius: item.radius + 'px' }
}
</script>

<style scoped>
.empty-state {
  flex: 1; display: flex; flex-direction: column;
  align-items: center; justify-content: center;
  gap: 0.8rem;
}
.empty-icon { font-size: 3rem; }
.empty-title { font-size: 1.25rem; font-weight: bold; }
.empty-desc { font-size: 0.9rem; color: var(--vscode-descriptionForeground); }
.empty-btn {
  padding: 0.5rem 2rem; font-size: 0.95rem; margin-top: 0.5rem;
  cursor: pointer; border: none; border-radius: 0.2rem;
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
  transition: background 0.15s, transform 0.1s;
}
.empty-btn:active { transform: scale(0.97); }
.empty-btn:hover { background: var(--vscode-button-hoverBackground); }
.empty-legend { display: flex; gap: 2rem; margin-top: 1.5rem; }
.legend-item { display: flex; align-items: center; gap: 0.3rem; font-size: 0.85rem; color: var(--vscode-descriptionForeground); }
.legend-dot { width: 11px; height: 11px; display: inline-block; }
</style>
