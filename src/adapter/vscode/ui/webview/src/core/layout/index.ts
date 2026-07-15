/**
 * @intent
 * 纯布局算法。不依赖任何外部数据模型，只算树形图的排列位置。
 *
 * 分两遍：
 *   第一遍 calcSubtreeWidth — 自底向上，每棵子树的宽度由最宽的子节点层决定
 *   第二遍 layoutNode — 自顶向下，父节点水平居中于子节点中心上方
 */

export const LEVEL_HEIGHT = 90
export const NODE_GAP = 1
export const TREE_TOP = 48
export const TREE_LEFT = 24

/**
 * @contract
 * 第一遍：自底向上计算子树宽度。
 * 输入：node - 必须有 w（px 宽度）和 children
 * 副作用：写入 node.subtreeW
 */
export function calcSubtreeWidth(node: any): void {
  if (node.children?.length) {
    node.children.forEach(calcSubtreeWidth)
    let total = 0
    for (let i = 0; i < node.children.length; i++) {
      total += (i > 0 ? NODE_GAP : 0) + node.children[i].subtreeW
    }
    node.subtreeW = Math.max(node.w, total)
  } else {
    node.subtreeW = node.w
  }
}

/**
 * @contract
 * 第二遍：自顶向下计算节点位置。
 * 父节点位置固定，子节点以父节点中线为轴对称排列。
 * 输入：node - 必须有 subtreeW、w、h
 * 副作用：写入 node.x、node.y
 */
export function layoutNode(node: any, x: number, y: number): void {
  node.x = x
  node.y = y

  if (node.children?.length) {
    const parentCx = x + node.w / 2   // 父节点中线
    let total = 0
    for (let i = 0; i < node.children.length; i++) {
      total += (i > 0 ? NODE_GAP : 0) + node.children[i].subtreeW
    }
    let childX = parentCx - total / 2  // 子节点组居中于父节点中线
    const childY = y + LEVEL_HEIGHT
    for (let i = 0; i < node.children.length; i++) {
      layoutNode(node.children[i], childX, childY)
      childX += node.children[i].subtreeW + NODE_GAP
    }
  }
}

/**
 * @contract
 * 展平树为数组。
 * 输入：node - 树根
 *       out - 可选，外部数组
 * 输出：展平后的节点数组
 * 副作用：无
 */
export function flattenTree(node: any, out: any[] = []): any[] {
  out.push(node)
  if (node.children) node.children.forEach((c: any) => flattenTree(c, out))
  return out
}
