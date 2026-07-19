/**
 * @intent
 * 文本资源统一预处理入口。
 * 所有 resource/text/ 下的文本经过 Pretext prepare 缓存，
 * 组件直接消费 PreparedText，后续 layout() 纯算术 0.0002ms。
 */

import { prepare, type PreparedText } from '@chenglou/pretext'

const _cache = new Map<string, PreparedText>()

/**
 * 获取 PreparedText（带缓存）。
 * 相同文本+字体只 prepare 一次。
 */
export function prepareText(text: string, font: string): PreparedText {
  const key = `${text}|${font}`
  if (!_cache.has(key)) {
    _cache.set(key, prepare(text, font))
  }
  return _cache.get(key)!
}

export type { PreparedText }
