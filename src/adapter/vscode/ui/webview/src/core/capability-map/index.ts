/**
 * @intent
 * 能力地图核心层统一出口。
 * 只导出引擎无关的纯逻辑：状态管理、行为状态机、接口类型。
 * 渲染相关功能在 renderer/ 中，页面编排在 pages/ 中。
 */

export { state, dryRun, invokeAction, initMessages, toggleSelectionMode, setSelectedIds } from './state'
export { dragMachine, calcZoom } from './behavior'
export type { SceneManager } from './types'
