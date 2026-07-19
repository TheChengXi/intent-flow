/**
 * @intent
 * 基于 Pretext 的文本高度计算器工厂。
 * @boundary
 * prepare 阶段在首次调用时惰性执行结果会被内层缓存复用。
 * 仅在字体或文本变化时才重新 prepare，否则只跑 layout（纯算术）。
 */

import { prepare, layout } from '@chenglou/pretext'
import type { TextHeightResolver } from './types'

const cache = new Map<string, ReturnType<typeof prepare>>()

/**
 * @contract
 * 创建 Pretext 文本高度计算器。
 * 输入：无
 * 输出：TextHeightResolver
 * 副作用：内部维护 prepare 缓存
 */
export function createPretextResolver(): TextHeightResolver {
  return (text: string, font: string, lineHeight: number, containerWidth: number): number => {

    // @step: 命中缓存则跳过 prepare
    const key = `${text}|${font}`
    if (!cache.has(key)) {
      cache.set(key, prepare(text, font))
    }

    // @step: pure arithmetic, 0.0002ms
    const { height } = layout(cache.get(key)!, containerWidth, lineHeight)
    return height
  }
}

/**
 * @contract
 * 清空 prepare 缓存。字体频繁切换时调用。
 * 输入：无
 * 输出：void
 * 副作用：清空内部缓存
 */
export function clearTextCache(): void {
  cache.clear()
}
