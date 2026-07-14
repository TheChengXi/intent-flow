<template>
  <div class="capability-map">
    <Toolbar />
    <!-- Canvas 始终渲染，空/加载时隐藏 -->
    <div class="canvas-wrap" :class="{ 'canvas-hidden': !state.rootData || state.loading }">
      <div ref="canvasRef" class="canvas" />
      <PathIndicator />
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

// ── Core: 引擎无关逻辑 ──
import { state, invokeAction, initMessages } from '@core/capability-map'
import { dragMachine } from '@core/capability-map'

// ── Renderer: 渲染引擎（工厂函数，每次返回新实例） ──
import { createSceneManager } from '../../renderer/leafer'

// ── Composable: 胶水层 ──
import { initWatcher, scheduleRender } from './composable'

// ── Overlay: Vue DOM 组件 ──
import Toolbar from '@overlay/toolbar/Toolbar.vue'
import EmptyState from '@overlay/empty-state/EmptyState.vue'
import InfoPanel from '@overlay/info-panel/InfoPanel.vue'
import Toast from '@overlay/toast/Toast.vue'
import MapTools from '@overlay/map-tools/MapTools.vue'
import PathIndicator from '@overlay/path-indicator/PathIndicator.vue'

// ── 实例化 SceneManager（内部状态闭包在实例内，无模块级共享状态） ──
const scene = createSceneManager()

// ── DOM ref ──
const canvasRef = ref<HTMLDivElement | null>(null)

// ── 状态机实例 ──
const { snapshot: dragSnapshot, send: dragSend } = useActor(dragMachine)

// ── 生命周期 ──
onMounted(() => {
  if (!canvasRef.value) return

  // ① 创建场景
  scene.createScene(canvasRef.value)

  // ② 绑定交互事件
  scene.bindEvents(dragSnapshot, dragSend)

  // ③ 启动响应式渲染
  initWatcher(scene)

  // ④ 注册 VS Code 消息
  initMessages()

  // ⑤ ResizeObserver
  const ro = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect
    invokeAction('resize', { width, height })
    scheduleRender(scene)
  })
  ro.observe(canvasRef.value)
  ;(window as any).__ro = ro
})

onUnmounted(() => {
  scene.unbindEvents()
  scene.destroyScene()
  const ro = (window as any).__ro
  if (ro) ro.disconnect()
})
</script>

<style scoped>
.capability-map { height: 100%; display: flex; flex-direction: column; position: relative; }

.canvas-wrap { flex: 1; min-height: 0; position: relative; overflow: hidden; }
.canvas { width: 100%; height: 100%; }
.canvas-hidden { display: none; }
</style>
