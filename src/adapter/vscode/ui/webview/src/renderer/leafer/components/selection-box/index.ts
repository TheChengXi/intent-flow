/**
 * @intent
 * webview 画布选区框组件的对外出口，转发 updateRect/removeRect 渲染函数，统一 selection-box 渲染能力的引用入口。
 * 边界：仅转发不实现，实现位于 render.ts。
 * 验收条件：
 * - updateRect 与 removeRect 均可从此入口导入
 */

export { updateRect, removeRect } from './render'
