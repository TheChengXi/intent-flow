/**
 * @intent
 * 能力地图页面胶水层。
 * 连接 core（状态管理）与 renderer（渲染引擎实例），负责响应式渲染调度。
 * 所有函数接收 scene（SceneManager 实例）作为参数，不依赖模块级变量。
 */

import { watch, nextTick } from 'vue'
import { state } from '@core/capability-map'
import { readToken } from '../../renderer/leafer'
import type { SceneManager } from '../../renderer/leafer'

let _watcherInitialized = false

/**
 * 启动响应式渲染监听。
 * @param scene - SceneManager 实例（由调用方持有）
 */
export function initWatcher(scene: SceneManager): void {
  if (_watcherInitialized) return
  _watcherInitialized = true

  watch(
    () => [
      state.rootData,
      state.loading,
      JSON.stringify(state.expanded),
      JSON.stringify(state.cache),
      state.infoVisible,
      state.infoFile,
      state.infoIntent,
      state.toastVisible,
      state.toastMsg,
      JSON.stringify(state.selectedIds),
      state.selectionMode,
    ],
    () => scheduleRender(scene),
    { deep: true },
  )

  // 退出选择模式时清除画布上的虚线框
  watch(() => state.selectionMode, (mode) => {
    if (!mode) scene.clearSelectionDisplay()
  })
}

/**
 * 调度一次渲染。
 * @param scene - SceneManager 实例（由调用方持有）
 */
export function scheduleRender(scene: SceneManager): void {
  nextTick(() => {
    if (!scene.isReady()) return
    const ref = scene.getCanvasRef()
    if (!ref) return
    const rect = ref.getBoundingClientRect()
    const tokens = readToken()
    scene.buildScene(tokens, rect.width || 800, rect.height || 600)
  })
}
