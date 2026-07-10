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
  /** 文件名称的字体，与 render 保持一致 */
  font: '12px sans-serif',
}

export function createNode(overrides?: Partial<ConvertNode>): ConvertNode {
  return { ...protocol, ...overrides }
}
