/**
 * @intent
 * 缩放 behavior。
 * 管理滚轮缩放、重置视图、放大/缩小按钮。
 */

import { state } from '@core/capability-map'
import type { SceneContext } from '../types'

export interface ZoomControls {
  onWheel(e: any): void
  resetView(): void
  zoomIn(): void
  zoomOut(): void
}

export function createZoomControls(ctx: SceneContext): ZoomControls {
  function onWheel(e: any) {
    if (!state.rootData || state.loading || !ctx.mapLayer || state.selectionMode) return
    const ratio = e.deltaY > 0 ? 0.88 : 1.14
    const cur = state.zoom || 1
    const next = Math.max(0.15, Math.min(5, cur * ratio))
    ctx.mapLayer.scaleX = next
    ctx.mapLayer.scaleY = next
    state.zoom = next
  }

  function resetView() {
    if (!ctx.mapLayer) return
    ctx.mapLayer.scaleX = 1
    ctx.mapLayer.scaleY = 1
    ctx.mapLayer.x = 0
    ctx.mapLayer.y = 0
    state.zoom = 1
  }

  const ZOOM_STEP = 0.1

  function zoomIn() {
    if (!ctx.mapLayer) return
    const cur = state.zoom || 1
    const next = Math.min(5, +(cur + ZOOM_STEP).toFixed(2))
    ctx.mapLayer.scaleX = next
    ctx.mapLayer.scaleY = next
    state.zoom = next
  }

  function zoomOut() {
    if (!ctx.mapLayer) return
    const cur = state.zoom || 1
    const next = Math.max(0.15, +(cur - ZOOM_STEP).toFixed(2))
    ctx.mapLayer.scaleX = next
    ctx.mapLayer.scaleY = next
    state.zoom = next
  }

  return { onWheel, resetView, zoomIn, zoomOut }
}
