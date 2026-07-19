/**
 * @intent
 * 能力地图的数据映射层：原始数据 → 布局树。
 * 纯函数，不依赖渲染引擎和运行时状态。
 */

import { calcSubtreeWidth, layoutNode, flattenTree,
  TREE_LEFT, TREE_TOP, NODE_GAP } from '@core/layout'
import { compileNode, convertTree } from '../../converter'
import type { ConvertNode } from '../../converter'
import { protocol as folderProtocol } from './components/folder'
import { protocol as intentPackageProtocol } from './components/intent-package'
import { protocol as fileProtocol } from './components/file'
import { prepare, measureNaturalWidth } from '@chenglou/pretext'

/**
 * @contract
 * 原始数据 → 平铺节点列表 + 连线数据。
 * 副产品：无
 */
export function calcLayout(data: any, cw?: number, ch?: number) {
  if (!data.rootData) return { flatNodes: [], lineData: [] }
  const roots = buildTree(data.rootData, data.currentFolder, 'root')
  applyExpandState(roots, data.expanded, data.cache)
  preprocessNodes(roots)

  if (cw && ch) {
    const allNodes: any[] = []
    roots.forEach(r => flattenTree(r, allNodes))
    const protoRoot: ConvertNode = {
      identity: 'layout-root',
      css: { width: '100%', height: '100%' },
      slots: [{
        name: 'default',
        children: allNodes.map(n => ({
          identity: n.id,
          css: { ...n.protocol.css },
        })),
      }],
    }
    const compiled = compileNode(protoRoot)
    const pxMap = convertTree(compiled, cw, ch)
    for (const n of allNodes) {
      const px = pxMap.get(n.id)
      if (px) { n.w = px.width; n.h = px.height }
      if (n._prepared) {
        n.textWidth = measureNaturalWidth(n._prepared)
        // folder 宽度取 百分比换算宽 与 文字宽 的较大值
        // 避免短文字导致节点过窄、间距不均匀
        if (n.type === 'folder') n.w = Math.max(n.w, n.textWidth)
      }
      // 视觉中心偏移（相对 node.x），layout 和 connection-line 共用
      n.cxOffset = getCxOffset(n)
    }
  }

  roots.forEach(calcSubtreeWidth)
  let x = TREE_LEFT
  roots.forEach(r => { layoutNode(r, x, TREE_TOP); x += r.subtreeW + NODE_GAP * 2 })
  const flat: any[] = []
  roots.forEach(r => flattenTree(r, flat))
  return { flatNodes: flat }
}

/**
 * @contract
 * 将后端返回的能力地图数据转为布局树节点。
 * 副作用：无
 */
function buildTree(data: any, parentPath: string, prefix: string): any[] {
  if (!data) return []
  const nodes: any[] = []

  if (data.subdirectories?.length) {
    data.subdirectories.forEach((dir: string) => {
      const fullPath = (parentPath ? parentPath + '/' : '') + dir
      nodes.push({
        id: prefix + '|dir|' + dir,
        type: 'folder',
        label: dir,
        path: fullPath,
        children: [],
        expanded: false,
        protocol: { css: { ...folderProtocol.css } },
        textFont: folderProtocol.textFont,
        data: dir,
      })
    })
  }

  if (data.groups?.length) {
    data.groups.forEach((g: any) => {
      const gid = prefix + '|group|' + g.name
      const n: any = {
        id: gid,
        type: 'intent-package',
        label: g.name,
        path: gid,
        children: [],
        expanded: false,
        protocol: { css: { ...intentPackageProtocol.css } },
        textFont: intentPackageProtocol.textFont,
        data: g,
      }
      if (g.files) {
        g.files.forEach((f: any) => {
          const fileName = f.path || f.name || f
          n.children.push({
            id: gid + '|file|' + fileName,
            type: 'file',
            label: fileName,
            path: (parentPath ? parentPath + '/' : '') + fileName,
            children: [],
            expanded: false,
            protocol: { css: { ...fileProtocol.css } },
            textFont: fileProtocol.textFont,
            data: fileName,
          })
        })
      }
      nodes.push(n)
    })
  }

  if (data.files?.length) {
    data.files.forEach((f: any) => {
      const fileName = f.file || f.name || f
      nodes.push({
        id: prefix + '|file|' + fileName,
        type: 'file',
        label: fileName,
        path: (parentPath ? parentPath + '/' : '') + fileName,
        children: [],
        expanded: false,
        protocol: { css: { ...fileProtocol.css } },
        textFont: fileProtocol.textFont,
        data: fileName,
      })
    })
  }

  return nodes
}

/**
 * @contract
 * 注入展开/折叠状态。
 * 副作用：修改节点 expanded 字段，递归展开子节点
 */
function applyExpandState(nodes: any[], expanded: any, cache: any): void {
  nodes.forEach(n => {
    n.expanded = !!expanded[n.path]
    if (n.expanded && n.type === 'folder') {
      const childData = cache[n.path]
      if (childData) {
        const prefix = n.id
        n.children = buildTree(childData, n.path, prefix)
        preprocessNodes(n.children)
        applyExpandState(n.children, expanded, cache)
      }
    }
  })
}

/**
 * 对所有节点执行 pretext 预处理。
 * 副作用：写入 node._prepared
 */
function preprocessNodes(nodes: any[]): void {
  for (const n of nodes) {
    n._prepared = prepare(n.label, n.textFont)
    if (n.children?.length) preprocessNodes(n.children)
  }
}

/** 视觉中心偏移（相对 node.x），与各组件 render.ts 中的绘制位置对齐 */
function getCxOffset(node: any): number {
  switch (node.type) {
    case 'folder':
      // 文字 textAlign:'center' 居中于 x:0
      return 0
    case 'file':
      // 📄 (6,3) ~13px + 文字 (26,3) + padding [3,8]
      // 组合中点 = (6 + 26 + textWidth + 8) / 2 = (40 + textWidth) / 2
      return (40 + (node.textWidth || 80)) / 2
    case 'intent-package':
      // Group(node.x-50, node.y-50), 圆在 Group 内居中
      return 0
    default:
      return node.w / 2
  }
}


