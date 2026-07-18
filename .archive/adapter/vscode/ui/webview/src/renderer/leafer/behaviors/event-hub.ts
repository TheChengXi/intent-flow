/**
 * @intent
 * 轻量事件通道实现。
 * behavior 模块通过 hub.emit() 发出事件，UI 组件通过 hub.subscribe() 订阅。
 * 不依赖 Vue、不依赖 Leafer，纯函数式。
 */

import type { BehaviorEvent, BehaviorEventHub } from '../types'

export function createEventHub(): BehaviorEventHub {
  const listeners = new Map<string, Set<(data: any) => void>>()

  function emit(event: BehaviorEvent): void {
    const set = listeners.get(event.type)
    if (set) set.forEach(fn => fn((event as any).payload ?? event))
  }

  function subscribe(type: BehaviorEvent['type'], handler: (data: any) => void): () => void {
    if (!listeners.has(type)) listeners.set(type, new Set())
    listeners.get(type)!.add(handler)
    return () => listeners.get(type)?.delete(handler)
  }

  return { emit, subscribe }
}
