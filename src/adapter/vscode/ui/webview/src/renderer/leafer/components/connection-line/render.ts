/**
 * @intent
 * 连接线组件的渲染逻辑。
 * 绘制节点之间的连线，线上可浮动文本标注（如 import 路径）。
 * 文本排版预留 Pretext 接口，当前用 Leafer Text 暂代。
 */

import { Line, Text } from 'leafer-ui'

export interface RenderContext {
  parent: any
  nodes: any[]
  tokens: Record<string, string>
}

/**
 * @contract
 * 根据节点位置生成连线。
 * 副作用：无
 */
function computeLines(nodes: any[]): any[] {
  const lines: any[] = []
  nodes.forEach(node => {
    if (!node.children?.length) return

    const px = node.x + node.w / 2
    const py = node.y + node.h
    const first = node.children[0]
    const last  = node.children[node.children.length - 1]
    const lineY = py + 10
    const lx = first.x + first.w / 2
    const rx = last.x + last.w / 2

    // 垂直竖线：父节点底部 → 水平线
    if (lineY - py > 2) {
      lines.push({ x1: px, y1: py, x2: px, y2: lineY })
    }

    // 水平横线：第一个子节点 → 最后一个子节点
    if (rx - lx > 2) {
      lines.push({ x1: lx, y1: lineY, x2: rx, y2: lineY })
    }

    // 垂直短线：水平线 → 每个子节点顶部
    node.children.forEach((c: any) => {
      const cx = c.x + c.w / 2
      if (Math.abs(cx - px) > 1 || c.y - lineY > 2) {
        lines.push({ x1: cx, y1: lineY, x2: cx, y2: c.y })
      }
    })
  })
  return lines
}

export function render(ctx: RenderContext): void {
  const { parent, nodes, tokens } = ctx
  const lines = computeLines(nodes)

  // 画线
  lines.forEach(l => {
    parent.add(new Line({
      x: 0, y: 0,
      points: [l.x1, l.y1, l.x2, l.y2],
      stroke: tokens.panelBorder,
      strokeWidth: 1.5,
      strokeDash: [4, 3],
    }))

    // ── 预留：线上浮动文本 ──
    // 当节点带有 importLabel 时，在连线中点显示标注
    // 当前用 Leafer Text 暂代，后续接入 Pretext 实现精准排版
    //
    // if (l.label) {
    //   const mx = (l.x1 + l.x2) / 2
    //   const my = (l.y1 + l.y2) / 2
    //   // TODO: Pretext.layout(label, ...) → { width, height }
    //   parent.add(new Text({
    //     x: mx, y: my,
    //     text: l.label,
    //     fontSize: 10, fill: tokens.textMuted,
    //     textAlign: 'center',
    //     backgroundColor: tokens.bg,
    //     padding: [1, 4],
    //   }))
    // }
  })
}
