/**
 * @intent
 * 文件组件的 Leafer 渲染逻辑。
 * textWrap: false 禁止换行，背景挂在 Text 上自动跟随文本宽度。
 */

import { Group, Text } from 'leafer-ui'
import type { RenderContext } from '../types'

export function render(ctx: RenderContext): void {
  const { parent, node, tokens, invokeAction } = ctx

  const g = new Group({ x: node.x, y: node.y })
  g.__isInteractive = true

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
  g.on('pointer.enter', () => {
    label.backgroundColor = 'rgba(232,67,147,0.25)'
    hoverTimer = setTimeout(() => invokeAction('hoverFile', { label: node.label }), 300)
  })
  g.on('pointer.leave', () => {
    label.backgroundColor = 'rgba(232,67,147,0.15)'
    clearTimeout(hoverTimer)
  })

  parent.add(g)
}
