/**
 * @intent
 * 能力地图页面的 03 运行时数据层。
 * 负责：reactive state、dryRun/invokeAction 调度、VS Code 消息通信、操作函数。
 * 不关心渲染、布局、状态机迁移。
 */

import { reactive } from 'vue'
import { calcZoom } from './behavior'

interface CapabilityState {
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

let toastTimer: ReturnType<typeof setTimeout> | null = null
const vscode = (window as any).acquireVsCodeApi?.() || { postMessage: () => {} }

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
  selectedIds: [], // { label, type }[]
})

// ── dryRun：纯函数验证，不修改状态 ──

export function dryRun(name: string, payload: any = {}): any {
  switch (name) {
    case 'resize':
      return { cw: payload.width, ch: payload.height }
    case 'resetView':
      return { x: 0, y: 0, scale: 1 }
    case 'zoom':
      return { scale: calcZoom(payload.currentZoom ?? 1, payload.delta) }
    case 'selectFolder':
    case 'loadFolder':
    case 'toggleFolder':
    case 'traceGroup':
    case 'hoverFile':
    case 'hideInfo':
    case 'copyMap':
    case 'toggleSelectionMode':
    case 'clearSelection':
      return { valid: true }
    default:
      return null
  }
}

// ── invokeAction：执行动作，修改状态 ──

export function invokeAction(name: string, payload: any = {}): any {
  const result = dryRun(name, payload)
  if (result === null) return null

  switch (name) {
    case 'selectFolder':
      selectFolder()
      break
    case 'loadFolder':
      if (state.folderPath.trim()) loadFolder(state.folderPath.trim())
      break
    case 'toggleFolder':
      toggleExpand(payload.path)
      break
    case 'traceGroup':
      traceGroup(payload.data, payload.label)
      break
    case 'hoverFile':
      hoverFile(payload.label)
      break
    case 'hideInfo':
      hideInfo()
      break
    case 'copyMap':
      copyMap()
      break
    case 'toggleSelectionMode':
      toggleSelectionMode()
      break
    case 'clearSelection':
      state.selectedIds = []
      break
  }

  return result
}

// ── VS Code 消息通信 ──

function handleFolderData(data: any): void {
  state.loading = false
  const dataPath = data.folder || ''
  if (!state.currentFolder || dataPath === state.currentFolder) {
    state.currentFolder = dataPath
    state.rootData = data
    state.expanded = {}
    state.cache = {}
  } else {
    for (const key in state.expanded) {
      if (state.expanded[key] && !state.cache[key]) {
        state.cache[key] = data
        break
      }
    }
  }
  state.status = '✅ ' + ((data.files?.length) || 0) + ' 个文件'
}

export function initMessages(): void {
  window.addEventListener('message', (event: MessageEvent) => {
    const msg = event.data
    switch (msg.type) {
      case 'folderData':
        handleFolderData(msg.data)
        break
      case 'folderPathUpdated':
        state.currentFolder = msg.folder
        break
      case 'traceData':
        state.status = '✅ 依赖追踪完成'
        break
      case 'intentDetail':
        state.infoFile = msg.fileName || ''
        state.infoIntent = msg.intent || '（无 @intent）'
        state.infoVisible = true
        break
      case 'saveResult':
        state.status = msg.success ? '✅ ' + msg.message : '❌ ' + msg.message
        break
    }
  })
}

// ── 操作函数 ──

export function selectFolder(): void {
  vscode.postMessage({ type: 'selectFolderDialog' })
}

export function loadFolder(folder: string): void {
  if (!folder) return
  state.currentFolder = folder
  state.expanded = {}
  state.cache = {}
  state.rootData = null
  state.loading = true
  state.status = '加载中...'
  vscode.postMessage({ type: 'selectFolder', folder })
}

export function toggleExpand(path: string): void {
  if (state.expanded[path]) {
    delete state.expanded[path]
  } else {
    state.expanded[path] = true
    if (!state.cache[path]) {
      state.loading = true
      vscode.postMessage({ type: 'openSubfolder', folder: path })
    }
  }
}

export function traceGroup(group: any, entryName?: string): void {
  if (entryName) {
    state.status = '正在追踪依赖...'
    vscode.postMessage({
      type: 'doubleClickGroup',
      groupName: group.name,
      entryFile: entryName,
    })
  }
}

export function hoverFile(fileName: string): void {
  state.infoVisible = false
  setTimeout(() => {
    vscode.postMessage({ type: 'hoverFile', fileName })
  }, 10)
}

export function hideInfo(): void {
  state.infoVisible = false
}



export function toggleSelectionMode(): void {
  state.selectionMode = !state.selectionMode
  if (!state.selectionMode) {
    state.selectedIds = []
  }
}

export function setSelectedIds(ids: { label: string; type: string }[]): void {
  state.selectedIds = ids
}

function showToast(msg: string, dur = 2000): void {
  state.toastMsg = msg
  state.toastVisible = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    state.toastVisible = false
  }, dur)
}

export function copyMap(): void {
  if (!state.rootData) {
    showToast('暂无数据')
    return
  }

  const lines = ['# 能力地图: ' + state.currentFolder, '']

  if (state.selectedIds.length > 0) {
    // 有选中节点：直接输出选中项（扁平列表，不遍历树）
    state.selectedIds.forEach(s => {
      const icon = s.type === 'folder' ? '📁' : s.type === 'intent-package' ? '⭕' : '📄'
      lines.push('  ' + icon + ' ' + s.label)
    })
  } else {
    // 无选中节点：输出完整树
    walk(state.rootData, 0)
  }

  navigator.clipboard.writeText(lines.join('\n'))
    .then(() => showToast('✅ 已复制能力地图到剪贴板'))
    .catch(() => showToast('❌ 复制失败'))

  function walk(data: any, depth: number): void {
    const indent = '  '.repeat(depth)
    if (data.subdirectories) {
      data.subdirectories.forEach((d: string) => {
        const fp = state.currentFolder + '/' + d
        lines.push(indent + '📁 ' + d)
        if (state.expanded[fp] && state.cache[fp]) {
          walk(state.cache[fp], depth + 1)
        }
      })
    }
    if (data.groups) {
      data.groups.forEach((g: any) => {
        lines.push(indent + '⭕ ' + g.name)
        if (g.summary) lines.push(indent + '  > ' + g.summary)
        if (g.files) {
          g.files.forEach((f: any) => {
            lines.push(indent + '  📄 ' + (f.path || f.name || f))
          })
        }
      })
    }
    if (data.files) {
      data.files.forEach((f: any) => {
        lines.push(indent + '📄 ' + (f.file || f.name || f))
      })
    }
  }
}
