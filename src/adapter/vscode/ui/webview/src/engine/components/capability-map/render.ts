/**
 * @intent
 * 能力地图页面主渲染器。
 * 负责：场景管理、事件绑定、渲染调度 → 集成各子组件。
 * 子组件渲染逻辑委托给 empty-state / info-panel / toast / folder / group / file。
 */

import { watch, nextTick } from 'vue'
import { Leafer, Group, Rect, Text } from 'leafer-ui'
import { render as renderFolder } from '../folder'
import { render as renderGroup } from '../group'
import { render as renderFile } from '../file'

import { render as renderConnectionLine } from '../connection-line'
import { state, invokeAction as stateInvokeAction } from './state'
import { calcLayout } from './layout'
import { text as uiText } from '../../../resource/text/ui'
import { readToken } from '../../../resource/token'

// ════════════════════════════════════════════════════════════
// 场景内部状态
// ════════════════════════════════════════════════════════════

let app: any = null
let mapLayer: any = null
let overlayLayer: any = null
let canvasRef: HTMLElement | null = null

// ════════════════════════════════════════════════════════════
// 场景管理
// ════════════════════════════════════════════════════════════

export function createScene(container: HTMLElement) {
  canvasRef = container
  app = new Leafer({ view: container })
  mapLayer = new Group()
  overlayLayer = new Group()
  app.add(mapLayer)
  app.add(overlayLayer)
}

export function destroyScene() {
  if (app) { app.destroy(); app = null }
  mapLayer = null
  overlayLayer = null
  canvasRef = null
}

// ════════════════════════════════════════════════════════════
// 交互事件绑定
// ════════════════════════════════════════════════════════════

const dragOrigin = { x: 0, y: 0, layerX: 0, layerY: 0 }
let dragSnapshot: any = null
let dragSend: any = null

export function bindEvents(dragSnap: any, dragSnd: any) {
  dragSnapshot = dragSnap
  dragSend = dragSnd
  if (!app) return
  app.on('pointer.down', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  app.on('wheel', onWheel)
}

export function unbindEvents() {
  if (!app) return
  app.off('pointer.down', onPointerDown)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  app.off('wheel', onWheel)
}

function onPointerDown(e: any) {
  if (!state.rootData || state.loading) return
  if (e.target?.__isInteractive) return
  dragSend?.({ type: 'DRAG_START' })
  if (!mapLayer) return
  dragOrigin.x = mapLayer.x
  dragOrigin.y = mapLayer.y
  dragOrigin.layerX = e.x
  dragOrigin.layerY = e.y
}

function onPointerMove(e: any) {
  if (!dragSnapshot?.value?.matches('dragging') || !mapLayer) return
  mapLayer.x = dragOrigin.x + (e.x - dragOrigin.layerX)
  mapLayer.y = dragOrigin.y + (e.y - dragOrigin.layerY)
}

function onPointerUp() {
  if (dragSnapshot?.value?.matches('dragging')) {
    dragSend?.({ type: 'DROP' })
  }
}

function onWheel(e: any) {
  if (!state.rootData || state.loading || !app) return
  const ratio = e.deltaY > 0 ? 0.88 : 1.14
  app.zoom = Math.max(0.15, Math.min(5, app.zoom * ratio))
  state.zoom = app.zoom
}

export function resetView() {
  if (!app || !mapLayer) return
  app.zoom = 1
  mapLayer.x = 0
  mapLayer.y = 0
  state.zoom = 1
}

// ════════════════════════════════════════════════════════════
// 响应式渲染调度
// ════════════════════════════════════════════════════════════

let _watcherInitialized = false

export function initWatcher() {
  if (_watcherInitialized) return
  _watcherInitialized = true

  watch(
    () => [
      state.rootData,
      state.loading,
      JSON.stringify(state.expanded),
      JSON.stringify(state.cache),
      state.infoVisible,
      state.infoFile,
      state.infoIntent,
      state.toastVisible,
      state.toastMsg,
    ],
    () => scheduleRender(),
    { deep: true },
  )
}

export function scheduleRender() {
  nextTick(() => {
    if (!app || !canvasRef) return
    const rect = canvasRef.getBoundingClientRect()
    const tokens = readToken()
    buildScene(tokens, rect.width || 800, rect.height || 600)
  })
}

// ════════════════════════════════════════════════════════════
// 场景图构建 — 集成各子组件
// ════════════════════════════════════════════════════════════

function localInvokeAction(name: string, payload: any = {}) {
  if (name === 'resetView') { resetView(); return { x: 0, y: 0, scale: 1 } }
  stateInvokeAction(name, payload)
}

function buildScene(tokens: Record<string, string>, cw: number, ch: number) {
  mapLayer.removeAll()
  overlayLayer.removeAll()

  // 空状态或加载中：重置偏移和缩放，不让之前的拖拽残留影响引导界面
  if (!state.rootData || state.loading) {
    mapLayer.x = 0
    mapLayer.y = 0
    if (app) { app.zoom = 1; state.zoom = 1 }
  }

  // 背景
  mapLayer.add(new Rect({ x: 0, y: 0, width: cw, height: ch, fill: tokens.bg }))

  if (state.loading) {
    renderLoading(tokens, cw, ch)
  } else if (state.rootData) {
    renderMap(tokens, cw, ch)
  }


}

// ── 加载状态 ──
function renderLoading(t: any, cw: number, ch: number) {
  const cx = cw * 0.5, cy = ch * 0.5
  overlayLayer.add(new Text({ x: cx - 50, y: cy - 15, text: '🔄', fontSize: 28, textAlign: 'center' }))
  overlayLayer.add(new Text({ x: cx - 15, y: cy - 8, text: uiText.loading, fontSize: 15, fill: t.textMuted }))
}

// ── 能力地图主视图 ──
function renderMap(t: any, cw: number, ch: number) {
  const { flatNodes: nodes } = calcLayout(state, cw, ch)

  mapLayer.add(new Text({ x: 16, y: 8, text: state.currentFolder, fontSize: 13, fill: t.textMuted }))

  // 连线（委托给 connection-line 组件）
  renderConnectionLine({ parent: mapLayer, nodes, tokens: t })

  // 子组件集成
  nodes.forEach((n: any) => {
    const renderCtx = { parent: mapLayer, node: n, tokens: t, data: state, invokeAction: localInvokeAction }
    if (n.type === 'folder') renderFolder(renderCtx)
    else if (n.type === 'group') renderGroup(renderCtx)
    else if (n.type === 'file') renderFile(renderCtx)
  })
}


