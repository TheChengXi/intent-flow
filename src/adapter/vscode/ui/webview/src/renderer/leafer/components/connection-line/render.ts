/**
 * @intent
 * 连接线组件的渲染逻辑。
 * 绘制节点之间的父子关系连线，带圆角。
 */

import { Line, Path } from 'leafer-ui'

export interface RenderContext {
  parent: any
  nodes: any[]
  tokens: Record<string, string>
}

/**
 * 配置
 */
const LINE_COLOR = 'textMuted'     // token key
const LINE_WIDTH = 1.2
const LINE_OPACITY = 0.5
const R = 4                         // 圆角半径

export function render(ctx: RenderContext): void {
  const { parent, nodes, tokens } = ctx
  const color = tokens[LINE_COLOR] || tokens.textMuted
  const lineStyle = { stroke: color, strokeWidth: LINE_WIDTH, opacity: LINE_OPACITY, fill: 'none' }

  nodes.forEach(node => {
    if (!node.children?.length) return

    const cx = node.x + node.w / 2       // 父节点水平中线
    const cy = node.y + node.h           // 父节点底部
    const first = node.children[0]
    const last  = node.children[node.children.length - 1]
    const lx = first.x + first.w / 2     // 第一个子节点中线
    const rx = last.x + last.w / 2       // 最后一个子节点中线
    const lineY = cy + 10                // 水平线 Y 坐标

    // ── ① 垂直竖线：父节点底部 → 水平线 ──
    parent.add(new Line({
      ...lineStyle,
      x: 0, y: 0,
      points: [cx, cy, cx, lineY],
    }))

    // ── ② 水平横线：最左 → 最右（如果有多个子节点） ──
    if (rx - lx > R * 2) {
      parent.add(new Line({
        ...lineStyle,
        x: 0, y: 0,
        points: [lx, lineY, rx, lineY],
      }))
    }

    // ── ③ 每个子节点：水平线 → 子节点顶部（带圆角） ──
    node.children.forEach((c: any) => {
      const cxc = c.x + c.w / 2
      const cyc = c.y
      const dy = cyc - lineY

      if (dy > R) {
        // 垂直下落够长才画，用 Path 做圆角
        parent.add(new Path({
          ...lineStyle,
          path:
            `M ${cxc} ${lineY} ` +
            `L ${cxc} ${cyc - R} ` +
            `Q ${cxc} ${cyc} ${cxc - R} ${cyc}`,
        }))
      } else if (dy > 0) {
        parent.add(new Line({
          ...lineStyle,
          x: 0, y: 0,
          points: [cxc, lineY, cxc, cyc],
        }))
      }
    })
  })
}
