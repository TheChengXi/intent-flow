/**
 * @file 递归百分比布局换算器
 * @intent
 * 协议树百分比 → px 的递归换算器。
 * 纯函数，无副作用，不引用任何框架。
 *
 * 换算规则遵循 CSS 百分比规范：
 *   width/height  → 参照容器的 width/height
 *   left/margin    → 参照容器 width（CSS 惯例）
 *   top            → 参照容器 height
 *
 * @example
 * ```ts
 * const compiled = compileNode(rawTree)
 * const pxMap = convertTree(compiled, { width: 1200, height: 800 })
 * pxMap.get('page.header.title') // → { x: 0, y: 0, width: 720, height: 40 }
 * ```
 */

import type { ConvertNode, CompiledNode, PxBounds, TextHeightResolver } from './types'

// ────────────────────────────────────
// 预编译：百分比 → 比值（协议加载时做一次）
// ────────────────────────────────────

/**
 * @contract
 * 将百分比字符串预解析为比值。
 * 输入："60%" | "100%" | undefined
 * 输出：0.6 | 1 | 0
 * 副作用：无
 */
function parseRatio(value: string | undefined): number {
  if (!value || value === 'auto') return 0
  return parseFloat(value) / 100
}

/**
 * 递归预编译整棵协议树。
 * 将所有百分比字符串提前解析为比值，换算阶段只做乘法。
 *
 * @param raw - 协议原始节点，含百分比字符串
 * @returns 编译后节点，所有百分比已解析为比值（0~1）
 */
export function compileNode(raw: ConvertNode): CompiledNode {
  return {
    identity: raw.identity,
    ratioWidth: raw.css.width === 'auto' ? 'auto' : parseRatio(raw.css.width),
    ratioHeight: raw.css.height === 'auto' ? 'auto' : parseRatio(raw.css.height),
    ratioX: parseRatio(raw.css.left),
    ratioY: parseRatio(raw.css.top),
    children: (raw.slots ?? []).flatMap(s => (s.children ?? []).map(compileNode)),
    textContent: raw.textContent,
    textFont: raw.textFont,
    textLineHeight: raw.textLineHeight,
  }
}

// ────────────────────────────────────
// 换算：比值 → px
// ────────────────────────────────────

/**
 * @contract
 * 节点内部的 text 换算逻辑。
 * 非 text 节点或缺少必要参数时返回 0。
 *
 * @param node  - 编译后节点
 * @param pw    - 容器宽度 px
 * @param textResolver - 外部注入的文本高度计算器
 * @returns textHeight px
 */
function resolveTextHeight(
  node: CompiledNode,
  pw: number,
  textResolver?: TextHeightResolver
): number {
  if (!node.textContent || !node.textFont || !node.textLineHeight || !textResolver) return 0
  if (node.ratioWidth === 'auto') return 0
  return textResolver(node.textContent, node.textFont, node.textLineHeight, pw * node.ratioWidth)
}

/**
 * 将单个编译节点换算为 PxBounds。
 * 宽度高度来自换算后的 px，不做字符串解析。
 *
 * @param node    - 编译后节点（含比值）
 * @param pw      - 容器宽度 px
 * @param ph      - 容器高度 px
 * @param textResolver - 可选文本高度计算器，用于 auto 高度文本节点
 * @returns 节点在容器内的 px 坐标和尺寸
 */
export function convertNode(
  node: CompiledNode,
  pw: number,
  ph: number,
  textResolver?: TextHeightResolver
): PxBounds {
  const width = node.ratioWidth === 'auto'
    ? 0
    : pw * node.ratioWidth

  const height = node.ratioHeight === 'auto'
    ? resolveTextHeight(node, pw, textResolver)
    : ph * node.ratioHeight

  return {
    x: pw * node.ratioX,
    y: ph * node.ratioY,
    width,
    height,
  }
}

/**
 * 递归换算整棵协议树，返回 identity → PxBounds 映射。
 * 每个节点的尺寸参照其父节点的 px 尺寸，
 * 根节点的父容器由 cw/ch 参数指定。
 *
 * @param root    - 编译后的根节点
 * @param cw      - 根容器宽度 px
 * @param ch      - 根容器高度 px
 * @param textResolver - 可选文本高度计算器
 * @returns identity 到 px 坐标的映射表
 */
export function convertTree(
  root: CompiledNode,
  cw: number,
  ch: number,
  textResolver?: TextHeightResolver
): Map<string, PxBounds> {
  const result = new Map<string, PxBounds>()

  function walk(node: CompiledNode, pw: number, ph: number): void {

    // @step: 换算当前节点
    if (node.ratioWidth !== 'auto' || node.textContent) {
      const bounds = convertNode(node, pw, ph, textResolver)
      result.set(node.identity, bounds)

      // @step: 递归子节点，以当前节点宽高为容器
      for (const child of node.children) {
        walk(child, bounds.width, bounds.height)
      }
    } else {
      // @step: auto 宽度且非文本节点，直接透传容器尺寸
      for (const child of node.children) {
        walk(child, pw, ph)
      }
    }
  }

  walk(root, cw, ch)
  return result
}
