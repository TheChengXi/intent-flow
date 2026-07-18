/**
 * @intent
 * 选中逻辑 behavior。
 * 提供框选命中测试、单选、追加切换等功能。
 * 不直接绑定事件，由 interaction 模块在适当时机调用。
 */

import { state, setSelectedIds } from '@core/capability-map'
import type { SceneContext } from '../types'

export interface SelectionActions {
  doSelectionHitTest(x1: number, y1: number, x2: number, y2: number, merge?: boolean): void
}

export function createSelectionActions(ctx: SceneContext): SelectionActions {
  function doSelectionHitTest(x1: number, y1: number, x2: number, y2: number, merge = false) {
    if (!ctx.mapLayer) return

    const sx = ctx.mapLayer.scaleX || 1
    const sy = ctx.mapLayer.scaleY || 1
    const lx = Math.min(x1, x2)
    const rx = Math.max(x1, x2)
    const ty = Math.min(y1, y2)
    const by = Math.max(y1, y2)
    const left   = (lx - ctx.mapLayer.x) / sx
    const right  = (rx - ctx.mapLayer.x) / sx
    const top    = (ty - ctx.mapLayer.y) / sy
    const bottom = (by - ctx.mapLayer.y) / sy

    const boxNodes = ctx.flatNodes.filter((n: any) => {
      const cx = n.x + (n.cxOffset ?? n.w / 2)
      const cy = n.y + (n.h || 40) / 2
      return cx >= left && cx <= right && cy >= top && cy <= bottom
    }).map((n: any) => ({ label: n.label, type: n.type })).filter((s: any) => s.label)

    if (merge) {
      const existingLabels = new Set(state.selectedIds.map((s: any) => s.label))
      const toAdd = boxNodes.filter((n: any) => !existingLabels.has(n.label))
      if (toAdd.length > 0) {
        setSelectedIds([...state.selectedIds, ...toAdd])
      }
    } else {
      setSelectedIds(boxNodes)
    }
  }

  return { doSelectionHitTest }
}
