/**
 * @intent
 * 能力地图的响应式数据层。
 * 只定义 CapabilityState 接口 + reactive state 实例。
 * 不包含任何业务逻辑或 VS Code 通信。
 */

import { reactive } from 'vue'

export interface CapabilityState {
  folderPath: string
  currentFolder: string
  rootData: any | null
  expanded: Record<string, boolean>
  cache: Record<string, any>
  loading: boolean
  status: string
  infoFile: string
  infoIntent: string
  infoVisible: boolean
  toastMsg: string
  toastVisible: boolean
  zoom: number
  selectionMode: boolean
  selectedIds: { label: string; type: string }[]
}

export const state = reactive<CapabilityState>({
  folderPath: '',
  currentFolder: '',
  rootData: null,
  expanded: {},
  cache: {},
  loading: false,
  status: '',
  infoFile: '',
  infoIntent: '',
  infoVisible: false,
  toastMsg: '',
  toastVisible: false,
  zoom: 1,
  selectionMode: false,
  selectedIds: [],
})
