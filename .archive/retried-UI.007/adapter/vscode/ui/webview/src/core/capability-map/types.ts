/**
 * @intent
 * 渲染引擎接口契约。
 * 定义 SceneManager 接口，所有渲染引擎（Leafer / Three.js / 原生 DOM）必须实现此接口。
 * core 层通过此接口与渲染引擎解耦。
 */

export interface SceneManager {
  /** 创建场景 */
  createScene(container: HTMLElement): void
  /** 销毁场景 */
  destroyScene(): void
  /** 绑定交互事件（拖拽、滚轮缩放等） */
  bindEvents(dragSnap: any, dragSend: any): void
  /** 解绑交互事件 */
  unbindEvents(): void
  /** 调度渲染 */
  scheduleRender(): void
  /** 重置视图（缩放、偏移归零） */
  resetView(): void
  /** 获取当前缩放比例 */
  getZoom(): number
}
