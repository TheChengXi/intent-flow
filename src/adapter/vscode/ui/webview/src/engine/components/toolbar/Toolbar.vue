<template>
  <header class="toolbar">
    <button class="btn btn-primary" @click="invokeAction('selectFolder')">
      {{ uiText.selectFolder }}
    </button>
    <span class="divider"></span>
    <input class="folder-input" v-model="state.folderPath"
      :placeholder="uiText.inputPlaceholder"
      @keydown.enter="invokeAction('loadFolder')"
    />
    <button class="btn btn-primary" @click="invokeAction('loadFolder')">
      {{ uiText.loadBtn }}
    </button>
    <span class="spacer"></span>
    <span class="status">{{ state.status }}</span>
  </header>
</template>

<script setup lang="ts">
import { state, invokeAction } from '../capability-map'
import { text as uiText } from '../../../resource/text/ui'
</script>

<style scoped>
.toolbar {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.4rem 0.8rem;
  border-bottom: 1px solid var(--vscode-panel-border);
  background: var(--vscode-sideBar-background);
  flex-shrink: 0;
}
.btn {
  padding: 0.3rem 0.7rem; cursor: pointer; border: none; border-radius: 0.2rem;
  white-space: nowrap; transition: background 0.15s, transform 0.1s;
  font-size: inherit;
}
.btn:active { transform: scale(0.97); }
.btn-primary {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}
.btn-primary:hover { background: var(--vscode-button-hoverBackground); }
.divider { width: 1px; height: 1.4rem; background: var(--vscode-panel-border); margin: 0 0.3rem; }
.folder-input {
  flex: 1; max-width: 40%;
  padding: 0.3rem 0.5rem;
  background: var(--vscode-input-background);
  color: var(--vscode-input-foreground);
  border: 1px solid var(--vscode-input-border); border-radius: 0.2rem; outline: none;
  font-size: inherit;
}
.folder-input:focus { border-color: var(--vscode-focusBorder); }
.spacer { flex: 1; }
.status { font-size: 0.85rem; color: var(--vscode-descriptionForeground); min-width: 10%; text-align: right; }
</style>
