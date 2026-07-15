/**
 * @intent
 * 连接线组件的渲染逻辑。
 * 根据每种节点类型的真实视觉尺寸计算连线端点，
 * 确保连接线对齐到原子节点的视觉中心/顶部/底部。
 *
 * 视觉锚点表（纯像素值，与 render/*.ts 中的绘制位置对齐）：
 *
 *   folder          📁 (0,0) fontSize:24 + 文字 (0,28) fontSize:12
 *                    文字中点: node.x, 视觉底部: node.y + 40
 *
 *   file            📄 (6,3) fontSize:13  → 宽≈13px, 高≈16px
 *                    视觉顶部: node.y + 3
 *
 *   intent-package  圆 r=50, Group(node.x-r, node.y-r)
 *                    视觉中心: (node.x, node.y)
 *                    视觉顶部: node.y - 50
 *                    视觉底部: node.y + 50
 */

import { Line } from 'leafer-ui'

export interface RenderContext {
  parent: any
  nodes: any[]
  tokens: Record<string, string>
}

/** 每种节点类型的视觉锚点 */
function getVisualAnchor(node: any): { cx: number; top: number; bottom: number } {
  switch (node.type) {
    case 'folder':
      // 📁 (0,0) fontSize:24 + 文字 (0,28) fontSize:12
      // 文字中点 = node.x, 视觉底部 = 文字底边 y:40
      return { cx: node.x, top: node.y, bottom: node.y + 40 }
    case 'file':
      // 📄 (6,3) fontSize:13 ≈ 13px + 文件名 (26,3) fontSize:12 + padding [3,8]
      // 组合视觉跨度：emoji 左 x:6 → 文字右 x:26+textWidth+8
      // 中点 = node.x + (6 + 26 + textWidth + 8) / 2
      const tw = node.textWidth || 80
      return { cx: node.x + (40 + tw) / 2, top: node.y + 3, bottom: node.y + 19 }
    case 'intent-package':
      // 圆 r=50, Group(node.x-r, node.y-r), 圆心在 (node.x, node.y)
      return { cx: node.x, top: node.y - 50, bottom: node.y + 50 }
    default:
      return { cx: node.x + (node.w || 60) / 2, top: node.y, bottom: node.y + (node.h || 30) }
  }
}

/**
 * @contract
 * 根据节点视觉锚点生成连线。无副作用。
 */
function computeLines(nodes: any[]): any[] {
  const lines: any[] = []

  nodes.forEach(node => {
    if (!node.children?.length) return

    const parentAnchor = getVisualAnchor(node)
    // 垂直落线 X = node.x + w/2（边界框中心），与 layoutNode 的居中计算一致
    const px = node.x + node.w / 2
    const py = parentAnchor.bottom
    const lineY = py + 10

    const first = node.children[0]
    const last  = node.children[node.children.length - 1]
    const firstAnchor = getVisualAnchor(first)
    const lastAnchor = getVisualAnchor(last)
    const lx = firstAnchor.cx
    const rx = lastAnchor.cx

    // 垂直竖线：父节点视觉底部 → 水平线
    if (lineY - py > 2) {
      lines.push({ x1: px, y1: py, x2: px, y2: lineY })
    }

    // 水平横线：第一个子节点视觉中心 → 最后一个子节点视觉中心
    if (rx - lx > 2) {
      lines.push({ x1: lx, y1: lineY, x2: rx, y2: lineY })
    }

    // 垂直短线：水平线 → 每个子节点视觉顶部
    node.children.forEach((c: any) => {
      const ca = getVisualAnchor(c)
      if (Math.abs(ca.cx - px) > 1 || ca.top - lineY > 2) {
        lines.push({ x1: ca.cx, y1: lineY, x2: ca.cx, y2: ca.top })
      }
    })
  })

  return lines
}

export function render(ctx: RenderContext): void {
  const { parent, nodes, tokens } = ctx
  const lines = computeLines(nodes)

  lines.forEach(l => {
    parent.add(new Line({
      x: 0, y: 0,
      points: [l.x1, l.y1, l.x2, l.y2],
      stroke: tokens.panelBorder,
      strokeWidth: 1.5,
      strokeDash: [4, 3],
    }))
  })
}
