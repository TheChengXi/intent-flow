/**
 * @intent
 * 意图包组件的 Leafer 渲染逻辑（圆形节点）。
 * 代表一个能力单元包，点击触发依赖追踪。
 */

import { Group, Rect, Text } from 'leafer-ui'
import type { RenderContext } from '../../types'

export function render(ctx: RenderContext): void {
  const { parent, node, tokens, data, invokeAction } = ctx
  const r = 50

  const g = new Group({ x: node.x - r, y: node.y - r })
  g.__isInteractive = true

  // @step: 选中高亮（蓝色外环）
  const isSelected = Array.isArray(data.selectedIds) && data.selectedIds.includes(node.label)
  if (isSelected) {
    g.add(new Rect({
      x: -6, y: -6,
      width: r * 2 + 12, height: r * 2 + 12, cornerRadius: r + 6,
      stroke: '#007acc', strokeWidth: 3,
      fill: 'rgba(0, 122, 204, 0.06)',
    }))
  }

  const circle = new Rect({
    x: 0, y: 0, width: r * 2, height: r * 2, cornerRadius: r,
    fill: {
      type: 'radial',
      stops: [
        { offset: 0, color: 'rgba(26,188,156,0.3)' },
        { offset: 1, color: 'rgba(26,188,156,0.08)' },
      ],
    },
    stroke: 'rgba(26,188,156,0.7)',
    strokeWidth: 2,
  })
  g.add(circle)

  g.add(new Text({
    x: r, y: r,
    text: node.label, fontSize: 13, fill: tokens.text,
    textAlign: 'center', verticalAlign: 'middle',
    fontWeight: 'bold', width: r * 2 - 16,
  }))

  g.on('pointer.enter', () => { circle.stroke = 'rgba(26,188,156,1)' })
  g.on('pointer.leave', () => { circle.stroke = 'rgba(26,188,156,0.7)' })
  g.on('tap', () => invokeAction('traceGroup', {
    data: node.data,
    label: node.children[0]?.label,
  }))

  parent.add(g)
}
