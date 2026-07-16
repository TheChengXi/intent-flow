/**
 * @intent
 * 指针交互 behavior。
 * 管理 pointer.down/move/up → 拖拽、框选、双击打开文件。
 * 读取 SceneContext 共享状态，通过 ctxRef 回调获取 selection 模块的 doSelectionHitTest。
 */

import { state, invokeAction as stateInvokeAction } from '@core/capability-map'
import { updateRect as updateSelRect, removeRect as removeSelRect } from '../components/selection-box'
import type { SceneContext } from '../types'

export interface PointerInteraction {
  bindEvents(dragSnap: any, dragSend: any): void
  unbindEvents(): void
  clearSelectionDisplay(): void
}

/**
 * 创建指针交互实例。
 * @param ctx - 共享场景上下文
 * @param getHitTest - 获取 selection 模块的 doSelectionHitTest 引用
 */
export function createPointerInteraction(
  ctx: SceneContext,
  getHitTest: () => (x1: number, y1: number, x2: number, y2: number, merge: boolean) => void,
): PointerInteraction {
  const _dragOrigin = { x: 0, y: 0, layerX: 0, layerY: 0 }
  let _dragSnapshot: any = null
  let _dragSend: any = null

  // ── 双击打开文件 ──
  function openFile(node: any) {
    // node.path 来自 layout.ts buildTree，已经是绝对路径
    const fp = node.path || node.label
    if (!fp) return
    ctx.events.emit({ type: 'openFile', path: fp, label: node.label })
  }

  function findNodeAt(px: number, py: number) {
    if (!ctx.mapLayer) return null
    const sx = ctx.mapLayer.scaleX || 1
    const sy = ctx.mapLayer.scaleY || 1
    const mx = (px - ctx.mapLayer.x) / sx
    const my = (py - ctx.mapLayer.y) / sy

    return ctx.flatNodes.find((n: any) => {
      const cx = n.x + (n.cxOffset ?? n.w / 2)
      const cy = n.y + (n.h || 40) / 2
      const hw = (n.w || 60) / 2 + 8
      const hh = (n.h || 40) / 2 + 8
      return Math.abs(mx - cx) <= hw && Math.abs(my - cy) <= hh
    })
  }

  function onPointerDown(e: any) {
    if (!state.rootData || state.loading) return

    if (state.selectionMode) {
      const hit = findNodeAt(e.x, e.y)
      if (hit) {
        // 点击节点：记录供双击检测，不框选
        const now = Date.now()
        if (hit === ctx.lastClickTarget && now - ctx.lastClickTime < 300) {
          // 双击文件 → 打开
          ctx.lastClickTarget = null
          ctx.lastClickTime = 0
          if (hit.type === 'file') {
            state.status = '双击: ' + hit.label + ' path=' + (hit.path || '无')
            openFile(hit)
          }
        } else {
          ctx.lastClickTarget = hit
          ctx.lastClickTime = now
          state.status = '单击: ' + hit.label
        }
        return
      }
      // 点在空白处：开始框选
      ctx.selStart = { x: e.x, y: e.y }
      return
    }

    if (e.target?.__isInteractive) return

    // 正常模式：拖拽画布
    _dragSend?.({ type: 'DRAG_START' })
    if (!ctx.mapLayer) return
    _dragOrigin.x = ctx.mapLayer.x
    _dragOrigin.y = ctx.mapLayer.y
    _dragOrigin.layerX = e.x
    _dragOrigin.layerY = e.y
  }

  function onPointerMove(e: any) {
    if (state.selectionMode && ctx.selStart) {
      if (ctx.overlayLayer) updateSelRect(ctx.overlayLayer, ctx.selStart.x, ctx.selStart.y, e.x, e.y)
      return
    }

    if (!_dragSnapshot?.value?.matches('dragging') || !ctx.mapLayer) return
    ctx.mapLayer.x = _dragOrigin.x + (e.x - _dragOrigin.layerX)
    ctx.mapLayer.y = _dragOrigin.y + (e.y - _dragOrigin.layerY)
  }

  function onPointerUp(e: any) {
    if (state.selectionMode && ctx.selStart) {
      getHitTest()(ctx.selStart.x, ctx.selStart.y, e.x, e.y, e.ctrlKey)
      ctx.selStart = null
      removeSelRect()
      return
    }

    if (_dragSnapshot?.value?.matches('dragging')) {
      _dragSend?.({ type: 'DROP' })
    }
  }

  // ── 快捷键 ──
  function onKeyDown(e: KeyboardEvent) {
    if ((e.ctrlKey || e.metaKey) && e.code === 'KeyC') {
      e.preventDefault()
      stateInvokeAction('copyMap')
    }
  }

  function bindEvents(dragSnap: any, dragSnd: any) {
    _dragSnapshot = dragSnap
    _dragSend = dragSnd
    if (!ctx.app) return
    ctx.app.on('pointer.down', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
  }

  function unbindEvents() {
    if (!ctx.app) return
    ctx.app.off('pointer.down', onPointerDown)
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
  }

  function clearSelectionDisplay() {
    ctx.selStart = null
    removeSelRect()
  }

  return { bindEvents, unbindEvents, clearSelectionDisplay }
}
