/**
 * @intent
 * 文件夹组件的协议定义。
 * 尺寸百分比参照画布容器，由 converter 运行时转为 px。
 */

import type { ConvertNode } from '../../../../converter'

export const protocol: ConvertNode = {
  identity: 'component://folder',
  css: {
    width: '8%',
    height: '10%',
  },
  /** 文件夹名称的字体，与 render 保持一致 */
  textFont: '12px sans-serif',
}

export function createNode(overrides?: Partial<ConvertNode>): ConvertNode {
  return {
    ...protocol,
    ...overrides,
  }
}
