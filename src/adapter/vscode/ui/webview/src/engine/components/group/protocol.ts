/**
 * @intent
 * 分组组件的协议定义（圆形节点）。
 */

import type { ConvertNode } from '../../converter'

export const protocol: ConvertNode = {
  identity: 'component://group',
  css: {
    width: '13%',
    height: '17%',
  },
  /** 分组名称的字体，与 render 保持一致 */
  font: 'bold 13px sans-serif',
}

export function createNode(overrides?: Partial<ConvertNode>): ConvertNode {
  return { ...protocol, ...overrides }
}
