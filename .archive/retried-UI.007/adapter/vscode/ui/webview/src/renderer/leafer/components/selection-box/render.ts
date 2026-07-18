/**
 * @intent
 * 选择框 Leafer 组件。
 * 在 overlayLayer 上绘制虚线矩形，供框选节点用。
 * 边界：不关心 state、不关心事件分发，只做矩形增删。
 */

import { Rect } from 'leafer-ui'

let _rect: any = null

export function updateRect(
  overlayLayer: any,
  x1: number, y1: number,
  x2: number, y2: number,
): void {
  const left   = Math.min(x1, x2)
  const top    = Math.min(y1, y2)
  const width  = Math.abs(x2 - x1)
  const height = Math.abs(y2 - y1)

  if (_rect) {
    _rect.x = left
    _rect.y = top
    _rect.width = width
    _rect.height = height
  } else {
    _rect = new Rect({
      x: left, y: top, width, height,
      stroke: '#007acc',
      strokeWidth: 1.5,
      strokeDashArray: [6, 4],
      fill: 'rgba(0, 122, 204, 0.08)',
    })
    overlayLayer.add(_rect)
  }
}

export function removeRect(): void {
  if (_rect) {
    _rect.remove()
    _rect = null
  }
}
