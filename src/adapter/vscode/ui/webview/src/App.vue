<template>
  <div class="capability-map">
    <Toolbar />
    <!-- Canvas 始终渲染，空/加载时隐藏 -->
    <div class="canvas-wrap" :class="{ 'canvas-hidden': !state.rootData || state.loading }">
      <div ref="canvasRef" class="canvas" />
      <MapTools />
    </div>
    <!-- DOM 渲染：空状态引导 -->
    <EmptyState v-if="!state.rootData && !state.loading" :invokeAction="invokeAction" />
    <InfoPanel :visible="state.infoVisible" :file="state.infoFile" :intent="state.infoIntent" :close="() => invokeAction('hideInfo')" />
    <Toast :visible="state.toastVisible" :msg="state.toastMsg" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useActor } from '@xstate/vue'
import { dragMachine } from './engine/components/capability-map/behavior'
import {
  createScene,
  destroyScene,
  bindEvents,
  unbindEvents,
  initWatcher,
  scheduleRender,
  state,
  invokeAction,
  initMessages,
} from './engine/components/capability-map'
import Toolbar from './engine/components/toolbar/Toolbar.vue'
import EmptyState from './engine/components/empty-state/EmptyState.vue'
import InfoPanel from './engine/components/info-panel/InfoPanel.vue'
import Toast from './engine/components/toast/Toast.vue'
import MapTools from './engine/components/map-tools/MapTools.vue'

// ── 100% div 地基 ──
const canvasRef = ref<HTMLDivElement | null>(null)

// ── 状态机实例（仅 App.vue 持有） ──
const { snapshot: dragSnapshot, send: dragSend } = useActor(dragMachine)

// ── 生命周期 ──
onMounted(() => {
  if (!canvasRef.value) return

  // ① 创建场景
  createScene(canvasRef.value)

  // ② 绑定交互事件
  bindEvents(dragSnapshot, dragSend)

  // ③ 启动响应式渲染
  initWatcher()

  // ④ 注册 VS Code 消息
  initMessages()

  // ⑤ ResizeObserver — resize 不改变 state，需手动触发渲染
  const ro = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect
    invokeAction('resize', { width, height })
    scheduleRender()
  })
  ro.observe(canvasRef.value)
  ;(window as any).__ro = ro
})

onUnmounted(() => {
  unbindEvents()
  destroyScene()
  const ro = (window as any).__ro
  if (ro) ro.disconnect()
})
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

<style scoped>
.capability-map { height: 100%; display: flex; flex-direction: column; position: relative; }

.canvas-wrap { flex: 1; min-height: 0; position: relative; overflow: hidden; }
.canvas { width: 100%; height: 100%; }
.canvas-hidden { display: none; }
</style>
