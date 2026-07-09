/**
 * @intent
 * 文件组件的协议定义。
 */

import type { ConvertNode } from '../../converter'

export const protocol: ConvertNode = {
  identity: 'component://file',
  css: {
    width: '15%',
    height: '5%',
  },
}

export function createNode(overrides?: Partial<ConvertNode>): ConvertNode {
  return { ...protocol, ...overrides }
}
