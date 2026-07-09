# App.vue 完整骨架

展示从 resize → dryRun → convertTree → buildScene 的完整闭环。

```vue
<template>
  <div ref="canvasRef" class="canvas" />
</template>

<script setup lang="ts">
// ── 运行时容器 ──
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import { Leafer, Group } from 'leafer-ui'
import { convertTree, compileNode } from './engine/converter'
import { buildScene } from './engine/components/capability-map'

const canvasRef = ref<HTMLDivElement | null>(null)

// ── Leafer 实例 ──
let app: any = null
let mapLayer: any = null

// ── 挂载 ──
onMounted(() => {
  if (!canvasRef.value) return
  app = new Leafer({ view: canvasRef.value })
  mapLayer = new Group()
  app.add(mapLayer)

  // 监听容器尺寸变化
  const ro = new ResizeObserver(([entry]) => {
    const { width, height } = entry.contentRect
    onResize(width, height)
  })
  ro.observe(canvasRef.value)

  // 首次渲染
  onResize(canvasRef.value.clientWidth, canvasRef.value.clientHeight)
})

// ── resize 流程 ──
function onResize(cw: number, ch: number) {
  // ① dryRun 验证
  const result = dryRun('resize', { cw, ch })
  if (!result) return

  // ② invokeAction — 执行换算 + 渲染
  scheduleRender(result.cw, result.ch)
}

function dryRun(name: string, payload: any) {
  if (name === 'resize') {
    // 可选：proportions 检查
    return { cw: payload.cw, ch: payload.ch }
  }
  return null
}

function scheduleRender(cw: number, ch: number) {
  nextTick(() => {
    if (!app || !canvasRef.value) return

    // ③ 换算：百分比 → px
    const compiled = compileNode({ width: '100%', height: '100%' })
    const [root] = convertTree([compiled], cw, ch)

    // ④ 构建场景图
    buildScene({
      app,
      mapLayer,
      root,
      cw,
      ch,
      tokens: readToken(),
    })
  })
}

// ── 主题色读取 ──
function readToken() {
  const g = (name: string, fallback: string) =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
  return {
    bg: g('--vscode-editor-background', '#1e1e1e'),
    text: g('--vscode-editor-foreground', '#d4d4d4'),
    primary: g('--vscode-button-background', '#0e639c'),
  }
}

// ── 销毁 ──
onUnmounted(() => {
  if (app) { app.destroy(); app = null }
})
</script>

<style>
.canvas { width: 100%; height: 100%; overflow: hidden; }
</style>
```
