/**
 * @intent
 * 能力地图的数据映射层：原始数据 → 布局树。
 * 纯函数，不依赖渲染引擎和运行时状态。
 */

import { calcSubtreeWidth, layoutNode, flattenTree,
  TREE_LEFT, TREE_TOP, NODE_GAP } from '../../layout'
import { compileNode, convertTree } from '../../converter'
import type { ConvertNode } from '../../converter'
import { protocol as folderProtocol } from '../folder'
import { protocol as groupProtocol } from '../group'
import { protocol as fileProtocol } from '../file'
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
      if (n._prepared && n.type === 'folder') {
        n.w = measureNaturalWidth(n._prepared)
      }
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
        font: folderProtocol.font,
        data: dir,
      })
    })
  }

  if (data.groups?.length) {
    data.groups.forEach((g: any) => {
      const gid = prefix + '|group|' + g.name
      const n: any = {
        id: gid,
        type: 'group',
        label: g.name,
        path: gid,
        children: [],
        expanded: false,
        protocol: { css: { ...groupProtocol.css } },
        font: groupProtocol.font,
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
            font: fileProtocol.font,
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
        font: fileProtocol.font,
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
    n._prepared = prepare(n.label, n.font)
    if (n.children?.length) preprocessNodes(n.children)
  }
}


