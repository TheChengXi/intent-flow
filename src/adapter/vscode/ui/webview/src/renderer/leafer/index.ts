/**
 * @intent
 * Leafer 渲染引擎统一出口。
 * createSceneManager() 工厂函数返回 SceneManager 实例，内部状态由实例闭包管理。
 * readToken() 是纯函数，独立导出。
 */

export { createSceneManager } from './scene'
export type { SceneManager } from './scene'
export { readToken } from '../../resource/token'
