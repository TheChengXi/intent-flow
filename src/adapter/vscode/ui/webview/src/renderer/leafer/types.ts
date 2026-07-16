/**
 * @intent
 * 渲染引擎通用类型定义。
 * RenderContext 是 Leafer 渲染引擎中所有组件 render() 函数的统一入参格式。
 * SceneContext 是 behaviors 模块共享的可变状态。
 */

export interface RenderContext {
  parent: any
  node: any
  tokens: Record<string, string>
  data: any
  invokeAction: (name: string, payload?: any) => void
}

/**
 * behaviors 模块共享的可变场景状态。
 * 所有模块读写同一个引用，保持状态一致。
 * events 是 behavior → UI 的事件通道，UI 通过它订阅 behavior 的行为通知。
 */
export interface SceneContext {
  app: any
  mapLayer: any
  overlayLayer: any
  canvasRef: HTMLElement | null
  /** 所有扁平节点的位置/尺寸数组（由 buildScene 设置） */
  flatNodes: any[]
  /** 框选起点（null = 未框选） */
  selStart: { x: number; y: number } | null
  /** 上一次单击命中的节点（用于双击检测） */
  lastClickTarget: any
  /** 上一次单击的时间戳 */
  lastClickTime: number
  /** behavior → UI 事件通道 */
  events: BehaviorEventHub
}

/**
 * behavior 模块触发的 UI 事件类型。
 * 每个事件携带 payload，UI 组件通过 subscribe 订阅。
 */
export type BehaviorEvent =
  | { type: 'openFile'; path: string; label: string }
  | { type: 'copyMap' }

/**
 * 轻量事件通道，behavior 模块通过它通知 UI，不直接操作 Vue state。
 */
export interface BehaviorEventHub {
  emit(event: BehaviorEvent): void
  /** 供 UI 组件在 mounted 时订阅 */
  subscribe(type: BehaviorEvent['type'], handler: (data: any) => void): () => void
}
