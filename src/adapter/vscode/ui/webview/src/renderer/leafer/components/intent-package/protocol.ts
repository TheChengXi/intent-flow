/**
 * @intent
 * 意图包组件协议定义（圆形节点）。
 * 代表一个能力单元（如一个 Go 包、一个模块），
 * 即 CDD 框架的核心抽象单元。
 */

import type { ConvertNode } from '../../../../converter'

export const protocol: ConvertNode = {
  identity: 'component://intent-package',
  css: {
    width: '13%',
    height: '17%',
  },
  textFont: 'bold 13px sans-serif',
}

export function createNode(overrides?: Partial<ConvertNode>): ConvertNode {
  return { ...protocol, ...overrides }
}
