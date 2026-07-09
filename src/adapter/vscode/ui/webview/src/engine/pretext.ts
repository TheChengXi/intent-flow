/**
 * @intent
 * Pretext — 纯数据文本排版引擎。
 * 底层使用 @chenglou/pretext，2.8k stars，React 核心成员 Cheng Lou 开发。
 * 不依赖 DOM 回流，可在 Canvas / SVG / 服务端运行。
 */

import {
  prepare as _prepare,
  layout as _layout,
  prepareWithSegments,
  layoutWithLines,
} from '@chenglou/pretext'

export interface LineInfo {
  text: string
  width: number
}

export interface LayoutResult {
  text: string
  width: number
  lineCount: number
  truncated: boolean
}

/**
 * 单行文本排版：测量 + 撑满容器，超出不截断。
 * 用于 layout 阶段撑大节点宽度，确保文本完整显示。
 */
export function measureWidth(text: string, fontSize: number, fontFamily = 'sans-serif'): number {
  const font = `${fontSize}px ${fontFamily}`
  const prepared = _prepare(text, font)
  const { height } = _layout(prepared, 99999, fontSize * 1.2)
  return height > 0 ? prepared['width'] ?? 0 : 0
}

// Re-export for advanced usage
export { _prepare as prepare, _layout as layout, prepareWithSegments, layoutWithLines }
