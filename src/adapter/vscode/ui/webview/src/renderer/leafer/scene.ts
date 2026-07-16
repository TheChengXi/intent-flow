/**
 * @intent
 * Leafer 渲染引擎的 SceneManager 工厂函数。
 * 每次调用 createSceneManager() 返回一个新实例，内部状态闭包在实例内。
 * 不污染模块级变量，不跨实例共享状态。
 */

import { Leafer, Group, Rect, Text } from 'leafer-ui'
import { state, invokeAction as stateInvokeAction, setSelectedIds } from '@core/capability-map'
import { render as renderFolder } from './components/folder'
import { render as renderIntentPackage } from './components/intent-package'
import { render as renderFile } from './components/file'
import { render as renderConnectionLine } from './components/connection-line'
import { updateRect as updateSelRect, removeRect as removeSelRect } from './components/selection-box'
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
  zoomIn(): void
  zoomOut(): void
  buildScene(tokens: Record<string, string>, cw: number, ch: number): void
  clearSelectionDisplay(): void
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

  // ── 选择框 / 双击状态 ──
  let _selStart: { x: number; y: number } | null = null
  let _flatNodes: any[] = []
  let _lastClickTarget: any = null
  let _lastClickTime = 0

  // ── 场景管理 ──
  function createScene(container: HTMLElement) {
    _canvasRef = container
    _app = new Leafer({ view: container })
    _mapLayer = new Group()
    _overlayLayer = new Group()
    _mapLayer.scaleX = 1
    _mapLayer.scaleY = 1
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
    window.addEventListener('wheel', onWheel, { passive: false })
  }

  function unbindEvents() {
    if (!_app) return
    _app.off('pointer.down', onPointerDown)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('wheel', onWheel)
  }

  function onPointerDown(e: any) {
    if (!state.rootData || state.loading) return

    if (state.selectionMode) {
      if (e.target?.__isInteractive) {
        const now = Date.now()
        const hit = findNodeAt(e.x, e.y)
        // 双击：同一节点 + 间隔 < 300ms
        if (hit && hit === _lastClickTarget && now - _lastClickTime < 300) {
          _lastClickTarget = null
          _lastClickTime = 0
          if (hit.type === 'file') openFile(hit)
          return
        }
        _lastClickTarget = hit
        _lastClickTime = now
        if (hit) {
          if (e.ctrlKey) {
            toggleNodeSelection(e.x, e.y)
          } else {
            selectNodeOnly(e.x, e.y)
          }
        }
        return
      }
      // 点在空白处：开始框选
      _lastClickTarget = null
      _selStart = { x: e.x, y: e.y }
      return
    }

    if (e.target?.__isInteractive) return

    // 正常模式：拖拽画布
    _dragSend?.({ type: 'DRAG_START' })
    if (!_mapLayer) return
    _dragOrigin.x = _mapLayer.x
    _dragOrigin.y = _mapLayer.y
    _dragOrigin.layerX = e.x
    _dragOrigin.layerY = e.y
  }

  function onPointerMove(e: any) {
    if (state.selectionMode && _selStart) {
      if (_overlayLayer) updateSelRect(_overlayLayer, _selStart.x, _selStart.y, e.x, e.y)
      return
    }

    if (!_dragSnapshot?.value?.matches('dragging') || !_mapLayer) return
    _mapLayer.x = _dragOrigin.x + (e.x - _dragOrigin.layerX)
    _mapLayer.y = _dragOrigin.y + (e.y - _dragOrigin.layerY)
  }

  function onPointerUp(e: any) {
    if (state.selectionMode && _selStart) {
      if (!e.ctrlKey) {
        doSelectionHitTest(_selStart.x, _selStart.y, e.x, e.y)
      }
      _selStart = null
      removeSelRect()
      return
    }

    if (_dragSnapshot?.value?.matches('dragging')) {
      _dragSend?.({ type: 'DROP' })
    }
  }



  // ── 双击打开 ──
  function openFile(node: any) {
    const fp = node.path || node.label
    if (!fp) return
    const absPath = state.currentFolder + '/' + fp
    // 通过 VS Code 消息打开文件
    const vscode = (window as any).acquireVsCodeApi?.() || { postMessage: () => {} }
    vscode.postMessage({ type: 'openFile', path: absPath })
  }

  function findNodeAt(px: number, py: number) {
    if (!_mapLayer) return null
    const sx = _mapLayer.scaleX || 1
    const sy = _mapLayer.scaleY || 1
    const mx = (px - _mapLayer.x) / sx
    const my = (py - _mapLayer.y) / sy

    return _flatNodes.find((n: any) => {
      const cx = n.x + (n.cxOffset ?? n.w / 2)
      const cy = n.y + (n.h || 40) / 2
      const hw = (n.w || 60) / 2 + 8
      const hh = (n.h || 40) / 2 + 8
      return Math.abs(mx - cx) <= hw && Math.abs(my - cy) <= hh
    })
  }

  function onWheel(e: any) {
    if (!state.rootData || state.loading || !_mapLayer || state.selectionMode) return
    const ratio = e.deltaY > 0 ? 0.88 : 1.14
    const cur = state.zoom || 1
    const next = Math.max(0.15, Math.min(5, cur * ratio))
    _mapLayer.scaleX = next
    _mapLayer.scaleY = next
    state.zoom = next
  }

  function resetView() {
    if (!_mapLayer) return
    _mapLayer.scaleX = 1
    _mapLayer.scaleY = 1
    _mapLayer.x = 0
    _mapLayer.y = 0
    state.zoom = 1
  }

  const ZOOM_STEP = 0.1

  function zoomIn() {
    if (!_mapLayer) return
    const cur = state.zoom || 1
    const next = Math.min(5, +(cur + ZOOM_STEP).toFixed(2))
    _mapLayer.scaleX = next
    _mapLayer.scaleY = next
    state.zoom = next
  }

  function zoomOut() {
    if (!_mapLayer) return
    const cur = state.zoom || 1
    const next = Math.max(0.15, +(cur - ZOOM_STEP).toFixed(2))
    _mapLayer.scaleX = next
    _mapLayer.scaleY = next
    state.zoom = next
  }

  // ── 选择框 ──
  function doSelectionHitTest(x1: number, y1: number, x2: number, y2: number) {
    if (!_mapLayer) return

    // 转换屏幕坐标 → 画布坐标（考虑 pan/zoom）
    const sx = _mapLayer.scaleX || 1
    const sy = _mapLayer.scaleY || 1
    const lx = Math.min(x1, x2)
    const rx = Math.max(x1, x2)
    const ty = Math.min(y1, y2)
    const by = Math.max(y1, y2)
    const left   = (lx - _mapLayer.x) / sx
    const right  = (rx - _mapLayer.x) / sx
    const top    = (ty - _mapLayer.y) / sy
    const bottom = (by - _mapLayer.y) / sy

    const selected = _flatNodes.filter((n: any) => {
      const cx = n.x + (n.cxOffset ?? n.w / 2)
      const cy = n.y + (n.h || 40) / 2
      return cx >= left && cx <= right && cy >= top && cy <= bottom
    })

    setSelectedIds(selected.map((n: any) => ({ label: n.label, type: n.type })).filter((s: any) => s.label))
  }

  function selectNodeOnly(px: number, py: number) {
    if (!_mapLayer) return
    const sx = _mapLayer.scaleX || 1
    const sy = _mapLayer.scaleY || 1
    const mx = (px - _mapLayer.x) / sx
    const my = (py - _mapLayer.y) / sy

    const hit = _flatNodes.find((n: any) => {
      const cx = n.x + (n.cxOffset ?? n.w / 2)
      const cy = n.y + (n.h || 40) / 2
      const hw = (n.w || 60) / 2 + 8
      const hh = (n.h || 40) / 2 + 8
      return Math.abs(mx - cx) <= hw && Math.abs(my - cy) <= hh
    })

    if (!hit) return
    setSelectedIds([{ label: hit.label, type: hit.type }])
  }

  function toggleNodeSelection(px: number, py: number) {
    const hit = findNodeAt(px, py)
    if (!hit) return
    const entry = { label: hit.label, type: hit.type }
    const idx = state.selectedIds.findIndex((s: any) => s.label === entry.label)
    if (idx >= 0) {
      state.selectedIds.splice(idx, 1)
    } else {
      state.selectedIds.push(entry)
    }
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
      _mapLayer.scaleX = 1
      _mapLayer.scaleY = 1
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
    const result = calcLayout(state, cw, ch)
    _flatNodes = result.flatNodes

    renderConnectionLine({ parent: _mapLayer, nodes: _flatNodes, tokens: t })

    _flatNodes.forEach((n: any) => {
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
    zoomIn,
    zoomOut,
    buildScene,
    clearSelectionDisplay,
  }

  function clearSelectionDisplay() {
    _selStart = null
    removeSelRect()
  }
}
