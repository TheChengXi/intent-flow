/**
 * @intent
 * Leafer 渲染引擎的 SceneManager 工厂函数。
 * 每次调用 createSceneManager() 返回一个新实例。
 * 内部将功能拆分为三个 behavior 模块（interaction / selection / zoom），
 * 通过共享 SceneContext 保持状态一致。
 */

import { Leafer, Group, Rect, Text } from 'leafer-ui'
import { state, invokeAction as stateInvokeAction } from '@core/capability-map'
import { render as renderFolder } from './components/folder'
import { render as renderIntentPackage } from './components/intent-package'
import { render as renderFile } from './components/file'
import { render as renderConnectionLine } from './components/connection-line'
import { calcLayout } from './layout'
import { text as uiText } from '@resource/text/ui'
import { createPointerInteraction } from './behaviors/interaction'
import { createSelectionActions } from './behaviors/selection'
import { createZoomControls } from './behaviors/zoom'
import { createEventHub } from './behaviors/event-hub'
import type { SceneContext, RenderContext } from './types'

export interface SceneManager {
  createScene(container: HTMLElement): void
  destroyScene(): void
  isReady(): boolean
  getCanvasRef(): HTMLElement | null
  bindEvents(dragSnap: any, dragSend: any): void
  unbindEvents(): void
  resetView(): void
  zoomIn(): void
  zoomOut(): void
  buildScene(tokens: Record<string, string>, cw: number, ch: number): void
  clearSelectionDisplay(): void
}

export function createSceneManager(): SceneManager {
  // ── 共享场景上下文 ──
  const hub = createEventHub()
  const ctx: SceneContext = {
    app: null,
    mapLayer: null,
    overlayLayer: null,
    canvasRef: null,
    flatNodes: [],
    selStart: null,
    lastClickTarget: null,
    lastClickTime: 0,
    events: hub,
  }

  // ── behavior 模块 ──
  const selection = createSelectionActions(ctx)
  const interaction = createPointerInteraction(ctx, () => selection.doSelectionHitTest)
  const zoom = createZoomControls(ctx)

  // ── 场景管理 ──
  function createScene(container: HTMLElement) {
    ctx.canvasRef = container
    ctx.app = new Leafer({ view: container })
    ctx.mapLayer = new Group()
    ctx.overlayLayer = new Group()
    ctx.mapLayer.scaleX = 1
    ctx.mapLayer.scaleY = 1
    ctx.app.add(ctx.mapLayer)
    ctx.app.add(ctx.overlayLayer)
  }

  function destroyScene() {
    if (ctx.app) { ctx.app.destroy(); ctx.app = null }
    ctx.mapLayer = null
    ctx.overlayLayer = null
    ctx.canvasRef = null
  }

  function isReady() {
    return ctx.app !== null && ctx.canvasRef !== null
  }

  function getCanvasRef() {
    return ctx.canvasRef
  }

  // ── 事件绑定委托 ──
  function bindEvents(dragSnap: any, dragSnd: any) {
    if (!ctx.app) return
    interaction.bindEvents(dragSnap, dragSnd)
    window.addEventListener('wheel', zoom.onWheel, { passive: false })
  }

  function unbindEvents() {
    if (!ctx.app) return
    interaction.unbindEvents()
    window.removeEventListener('wheel', zoom.onWheel)
  }

  // ── 缩放委托 ──
  function resetView() { zoom.resetView() }
  function zoomIn() { zoom.zoomIn() }
  function zoomOut() { zoom.zoomOut() }

  // ── 选中清除 ──
  function clearSelectionDisplay() {
    interaction.clearSelectionDisplay()
  }

  // ── 场景图构建 ──
  function localInvokeAction(name: string, payload: any = {}) {
    if (name === 'resetView') { resetView(); return { x: 0, y: 0, scale: 1 } }
    stateInvokeAction(name, payload)
  }

  function buildScene(tokens: Record<string, string>, cw: number, ch: number) {
    if (!ctx.mapLayer || !ctx.overlayLayer || !ctx.app) return

    ctx.mapLayer.removeAll()
    ctx.overlayLayer.removeAll()

    if (!state.rootData || state.loading) {
      ctx.mapLayer.x = 0
      ctx.mapLayer.y = 0
      ctx.mapLayer.scaleX = 1
      ctx.mapLayer.scaleY = 1
      state.zoom = 1
    }

    ctx.mapLayer.add(new Rect({ x: 0, y: 0, width: cw, height: ch, fill: tokens.bg }))

    if (state.loading) {
      renderLoading(tokens, cw, ch)
    } else if (state.rootData) {
      renderMap(tokens, cw, ch)
    }
  }

  function renderLoading(t: Record<string, string>, cw: number, ch: number) {
    const cx = cw * 0.5, cy = ch * 0.5
    ctx.overlayLayer.add(new Text({ x: cx - 50, y: cy - 15, text: '🔄', fontSize: 28, textAlign: 'center' }))
    ctx.overlayLayer.add(new Text({ x: cx - 15, y: cy - 8, text: uiText.loading, fontSize: 15, fill: t.textMuted }))
  }

  function renderMap(t: Record<string, string>, cw: number, ch: number) {
    const result = calcLayout(state, cw, ch)
    ctx.flatNodes = result.flatNodes

    renderConnectionLine({ parent: ctx.mapLayer, nodes: ctx.flatNodes, tokens: t })

    ctx.flatNodes.forEach((n: any) => {
      const renderCtx: RenderContext = {
        parent: ctx.mapLayer,
        node: n,
        tokens: t,
        data: state,
        invokeAction: localInvokeAction,
      }
      if (n.type === 'folder') renderFolder(renderCtx)
      else if (n.type === 'intent-package') renderIntentPackage(renderCtx)
      else if (n.type === 'file') renderFile(renderCtx)
    })
  }

  // ── 事件订阅（behavior → actions） ──
  hub.subscribe('openFile', (data) => {
    if (!data.path) return
    stateInvokeAction('openFile', { path: data.path, label: data.label })
  })

  return {
    createScene,
    destroyScene,
    isReady,
    getCanvasRef,
    bindEvents,
    unbindEvents,
    resetView,
    zoomIn,
    zoomOut,
    buildScene,
    clearSelectionDisplay,
  }
}
