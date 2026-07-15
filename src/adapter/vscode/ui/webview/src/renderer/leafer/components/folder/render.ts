/**
 * @intent
 * 文件夹组件的 Leafer 渲染逻辑。
 * 接受 RenderContext（节点位置/状态/token），在 parent Group 中创建：
 *   ① 📁 图标（emojis）
 *   ② 文件夹名称（Text）
 *   ③ 展开/折叠角标（+ / −）
 *   ④ hover 缩放动效（1.08x）
 *   ⑤ tap → toggleFolder（展开/折叠）
 *
 * 输入：RenderContext（node.x/y 来自 layout 计算）
 * 输出：向 parent 添加 Group 节点
 * 不关心：node 的 x/y 从哪来、尺寸是 px 还是 %
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

  // @step: 展开/折叠指示器（悬浮在图标右上角）
  const expanded = !!data.expanded[node.path]
  g.add(new Text({
    x: 14, y: -4,
    text: expanded ? '−' : '+', fontSize: 13, fill: '#9b59b6',
    textAlign: 'center', backgroundColor: tokens.bg,
    cornerRadius: 8, padding: [1, 4],
  }))

  // @step: hover 动效
  g.on('pointer.enter', () => { g.scaleX = 1.08; g.scaleY = 1.08 })
  g.on('pointer.leave', () => { g.scaleX = 1; g.scaleY = 1 })

  // @step: 点击切换展开
  g.on('tap', () => invokeAction('toggleFolder', { path: node.path }))

  parent.add(g)
}
