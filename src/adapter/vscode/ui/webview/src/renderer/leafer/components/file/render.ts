/**
 * @intent
 * 文件组件的 Leafer 渲染逻辑。
 * textWrap: false 禁止换行，背景挂在 Text 上自动跟随文本宽度。
 */

import { Group, Text, Rect } from 'leafer-ui'
import { state } from '@core/capability-map'
import type { RenderContext } from '../../types'

export function render(ctx: RenderContext): void {
  const { parent, node, tokens, data, invokeAction } = ctx

  const g = new Group({ x: node.x, y: node.y })
  g.__isInteractive = true
  node._leaferEl = g

  // @step: 选中高亮
  const isSelected = Array.isArray(data.selectedIds) && data.selectedIds.some((s: any) => s.label === node.label)
  if (isSelected) {
    const rw = 42 + (node.textWidth || 80)
    g.add(new Rect({
      x: 2, y: -1,
      width: rw, height: 26,
      stroke: '#007acc', strokeWidth: 2, cornerRadius: 6,
      fill: 'rgba(0, 122, 204, 0.06)',
    }))
  }

  // 图标
  g.add(new Text({ x: 6, y: 3, text: '📄', fontSize: 13 }))

  // 文件名 — textWrap: false 禁止换行，不设 width 自动撑开
  // backgroundColor + padding 让背景跟随文本宽度
  const label = new Text({
    x: 26, y: 3,
    text: node.label, fontSize: 12, fill: tokens.text,
    textWrap: false,
    backgroundColor: 'rgba(232,67,147,0.15)',
    padding: [3, 8],
    cornerRadius: 6,

  })
  g.add(label)

  let hoverTimer: any = null
  // 选择模式下不触发 hover
  g.on('pointer.enter', () => {
    g.scaleX = 1.08; g.scaleY = 1.08
    if (state.selectionMode) return
    label.backgroundColor = 'rgba(232,67,147,0.25)'
    hoverTimer = setTimeout(() => invokeAction('hoverFile', { label: node.label }), 300)
  })
  g.on('pointer.leave', () => {
    g.scaleX = 1; g.scaleY = 1
    label.backgroundColor = 'rgba(232,67,147,0.15)'
    clearTimeout(hoverTimer)
  })

  parent.add(g)
}
