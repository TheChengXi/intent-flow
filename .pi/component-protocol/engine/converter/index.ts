/**
 * @file 换算层统一出口
 * @intent
 * 外部只通过此文件 import，不直接引用 converter.ts 或 types.ts。
 */

export { compileNode, convertNode, convertTree } from './converter'
export type {
  PxBounds,
  ConvertNode,
  CompiledNode,
  TextHeightResolver,
} from './types'
