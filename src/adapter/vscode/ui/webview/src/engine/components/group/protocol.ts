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
}

export function createNode(overrides?: Partial<ConvertNode>): ConvertNode {
  return { ...protocol, ...overrides }
}
