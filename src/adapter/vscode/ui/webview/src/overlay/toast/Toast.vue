<template>
  <div v-if="visible" class="toast">
    {{ msg }}
  </div>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  msg: string
}>()
</script>

<style scoped>
.toast {
  position: absolute; left: 50%; bottom: 2rem;
  transform: translateX(-50%);
  font-size: 0.9rem;
  padding: 0.5rem 1.25rem;
  border-radius: 6px;
  background: var(--vscode-inputValidation-infoBackground);
  border: 1px solid var(--vscode-panel-border);
  z-index: 20;
  white-space: nowrap;
}
</style>
