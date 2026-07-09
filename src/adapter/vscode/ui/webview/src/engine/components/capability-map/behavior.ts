/**
 * @intent
 * 能力地图页面的状态机。
 * 拖拽画布：idle → dragging → idle
 */

import { createMachine } from 'xstate'

export const dragMachine = createMachine({
  id: 'capability-map-drag',
  initial: 'idle',
  states: {
    idle: {
      on: {
        DRAG_START: { target: 'dragging' },
      },
    },
    dragging: {
      on: {
        DROP: { target: 'idle' },
      },
    },
  },
})

/**
 * @contract
 * 计算缩放后的值。
 * 输入：delta - 滚轮方向
 * 输出：新的 scale
 * 副作用：无
 */
export function calcZoom(currentZoom: number, delta: number): number {
  const ratio = delta > 0 ? 0.88 : 1.14
  return Math.max(0.15, Math.min(5, currentZoom * ratio))
}
