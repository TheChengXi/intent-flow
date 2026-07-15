/**
 * @intent
 * Leafer 渲染引擎的 SceneManager 工厂函数。
 * 每次调用 createSceneManager() 返回一个新实例，内部状态闭包在实例内。
 * 不污染模块级变量，不跨实例共享状态。
 */

import { Leafer, Group, Rect, Text } from 'leafer-ui'
import { state, invokeAction as stateInvokeAction } from '@core/capability-map'
import { render as renderFolder } from './components/folder'
import { render as renderIntentPackage } from './components/intent-package'
import { render as renderFile } from './components/file'
import { render as renderConnectionLine } from './components/connection-line'
import { calcLayout } from './layout'
import { text as uiText } from '@resource/text/ui'
import type { RenderContext } from './types'

export interface SceneManager {
  createScene(container: HTMLElement): void
  destroyScene(): void
  isReady(): boolean
  getCanvasRef(): HTMLElement | null
  bindEvents(dragSnap: any, dragSend: any): void
  unbindEvents(): void
  resetView(): void
  buildScene(tokens: Record<string, string>, cw: number, ch: number): void
}

export function createSceneManager(): SceneManager {
  // ── 实例私有状态（闭包，不是模块级变量） ──
  let _app: any = null
  let _mapLayer: any = null
  let _overlayLayer: any = null
  let _canvasRef: HTMLElement | null = null

  const _dragOrigin = { x: 0, y: 0, layerX: 0, layerY: 0 }
  let _dragSnapshot: any = null
  let _dragSend: any = null

  // ── 场景管理 ──
  function createScene(container: HTMLElement) {
    _canvasRef = container
    _app = new Leafer({ view: container })
    _mapLayer = new Group()
    _overlayLayer = new Group()
    _app.add(_mapLayer)
    _app.add(_overlayLayer)
  }

  function destroyScene() {
    if (_app) { _app.destroy(); _app = null }
    _mapLayer = null
    _overlayLayer = null
    _canvasRef = null
  }

  function isReady() {
    return _app !== null && _canvasRef !== null
  }

  function getCanvasRef() {
    return _canvasRef
  }

  // ── 交互事件 ──
  function bindEvents(dragSnap: any, dragSnd: any) {
    _dragSnapshot = dragSnap
    _dragSend = dragSnd
    if (!_app) return
    _app.on('pointer.down', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    _app.on('wheel', onWheel)
  }

  function unbindEvents() {
    if (!_app) return
    _app.off('pointer.down', onPointerDown)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    _app.off('wheel', onWheel)
  }

  function onPointerDown(e: any) {
    if (!state.rootData || state.loading) return
    if (e.target?.__isInteractive) return
    _dragSend?.({ type: 'DRAG_START' })
    if (!_mapLayer) return
    _dragOrigin.x = _mapLayer.x
    _dragOrigin.y = _mapLayer.y
    _dragOrigin.layerX = e.x
    _dragOrigin.layerY = e.y
  }

  function onPointerMove(e: any) {
    if (!_dragSnapshot?.value?.matches('dragging') || !_mapLayer) return
    _mapLayer.x = _dragOrigin.x + (e.x - _dragOrigin.layerX)
    _mapLayer.y = _dragOrigin.y + (e.y - _dragOrigin.layerY)
  }

  function onPointerUp() {
    if (_dragSnapshot?.value?.matches('dragging')) {
      _dragSend?.({ type: 'DROP' })
    }
  }

  function onWheel(e: any) {
    if (!state.rootData || state.loading || !_app) return
    const ratio = e.deltaY > 0 ? 0.88 : 1.14
    _app.zoom = Math.max(0.15, Math.min(5, _app.zoom * ratio))
    state.zoom = _app.zoom
  }

  function resetView() {
    if (!_app || !_mapLayer) return
    _app.zoom = 1
    _mapLayer.x = 0
    _mapLayer.y = 0
    state.zoom = 1
  }

  // ── 场景图构建 ──
  function localInvokeAction(name: string, payload: any = {}) {
    if (name === 'resetView') { resetView(); return { x: 0, y: 0, scale: 1 } }
    stateInvokeAction(name, payload)
  }

  function buildScene(tokens: Record<string, string>, cw: number, ch: number) {
    if (!_mapLayer || !_overlayLayer || !_app) return

    _mapLayer.removeAll()
    _overlayLayer.removeAll()

    if (!state.rootData || state.loading) {
      _mapLayer.x = 0
      _mapLayer.y = 0
      _app.zoom = 1
      state.zoom = 1
    }

    _mapLayer.add(new Rect({ x: 0, y: 0, width: cw, height: ch, fill: tokens.bg }))

    if (state.loading) {
      renderLoading(tokens, cw, ch)
    } else if (state.rootData) {
      renderMap(tokens, cw, ch)
    }
  }

  function renderLoading(t: Record<string, string>, cw: number, ch: number) {
    const cx = cw * 0.5, cy = ch * 0.5
    _overlayLayer.add(new Text({ x: cx - 50, y: cy - 15, text: '🔄', fontSize: 28, textAlign: 'center' }))
    _overlayLayer.add(new Text({ x: cx - 15, y: cy - 8, text: uiText.loading, fontSize: 15, fill: t.textMuted }))
  }

  function renderMap(t: Record<string, string>, cw: number, ch: number) {
    const { flatNodes: nodes } = calcLayout(state, cw, ch)

    renderConnectionLine({ parent: _mapLayer, nodes, tokens: t })

    nodes.forEach((n: any) => {
      const renderCtx: RenderContext = {
        parent: _mapLayer,
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

  return {
    createScene,
    destroyScene,
    isReady,
    getCanvasRef,
    bindEvents,
    unbindEvents,
    resetView,
    buildScene,
  }
}
