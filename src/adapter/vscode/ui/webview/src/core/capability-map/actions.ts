/**
 * @intent
 * 能力地图的业务逻辑层。
 * 纯函数 + 副作用函数，操作 reactive state。
 * 不关心 VS Code 消息如何收发，只定义「做什么」。
 */

import { state } from './state'
import { calcZoom } from './behavior'

const vscode = (window as any).acquireVsCodeApi?.() || { postMessage: () => {} }

let toastTimer: ReturnType<typeof setTimeout> | null = null

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

// ── 业务操作函数 ──

function showToast(msg: string, dur = 2000): void {
  state.toastMsg = msg
  state.toastVisible = true
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    state.toastVisible = false
  }, dur)
}

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

/** 复制能力地图到剪贴板 */
export function copyMap(): void {
  if (!state.rootData) {
    showToast('暂无数据')
    return
  }

  const lines = ['# 能力地图: ' + state.currentFolder, '']

  if (state.selectedIds.length > 0) {
    state.selectedIds.forEach(s => {
      const icon = s.type === 'folder' ? '📁' : s.type === 'intent-package' ? '⭕' : '📄'
      lines.push('  ' + icon + ' ' + s.label)
    })
  } else {
    walk(state.rootData, 0)
  }

  navigator.clipboard.writeText(lines.join('\n'))
    .then(() => showToast('✅ 已复制能力地图到剪贴板'))
    .catch(() => showToast('❌ 复制失败'))

  function walk(data: any, depth: number): void {
    const indent = '  '.repeat(depth)
    if (data.subdirectories) {
      data.subdirectories.forEach((d: string) => {
        lines.push(indent + '📁 ' + d)
        const fp = state.currentFolder + '/' + d
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
