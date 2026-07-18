/**
 * @intent
 * 能力地图核心层统一出口。
 * state      — 响应式数据（Vue reactive）
 * actions    — 业务逻辑（dryRun/invokeAction/操作函数）
 * vscode-bridge — VS Code 消息收发
 * behavior   — 状态机
 */

export { state } from './state'
export { dryRun, invokeAction, toggleSelectionMode, setSelectedIds } from './actions'
export { initMessages } from './vscode-bridge'
export { dragMachine, calcZoom } from './behavior'
export type { SceneManager } from './types'
