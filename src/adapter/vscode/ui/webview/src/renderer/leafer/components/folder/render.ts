/**
 * @intent
 * 文件夹组件的 Leafer 渲染逻辑。
 * 只负责"怎么画"，不关心 layout 和尺寸来源。
 */

import { Group, Text } from 'leafer-ui'
import type { RenderContext } from '../../types'

export function render(ctx: RenderContext): void {
  const { parent, node, tokens, data, invokeAction } = ctx
  const g = new Group({ x: node.x, y: node.y })
  g.__isInteractive = true

  // @step: 文件夹图标
  g.add(new Text({
    x: 0, y: 0,
    text: '📁', fontSize: 24, textAlign: 'center',
  }))

  // @step: 文件夹名称（textWrap: false 让 Leafer 自动撑开，x:0 与图标同一中心）
  g.add(new Text({
    x: 0, y: 28,
    text: node.label, fontSize: 12, fill: tokens.text,
    textAlign: 'center',
    textWrap: false,
  }))

  // @step: 展开/折叠指示器
  if (node.children?.length) {
    const expanded = !!data.expanded[node.path]
    // 悬浮在图标右上角（部分重叠）
    g.add(new Text({
      x: 14, y: -4,
      text: expanded ? '−' : '+', fontSize: 13, fill: '#9b59b6',
      textAlign: 'center', backgroundColor: tokens.bg,
      cornerRadius: 8, padding: [1, 4],
    }))
  }

  // @step: hover 动效
  g.on('pointer.enter', () => { g.scaleX = 1.08; g.scaleY = 1.08 })
  g.on('pointer.leave', () => { g.scaleX = 1; g.scaleY = 1 })

  // @step: 点击切换展开
  g.on('tap', () => invokeAction('toggleFolder', { path: node.path }))

  parent.add(g)
}
