/**
 * @intent
 * VS Code 消息桥接层。
 * 负责 webview ↔ extension 之间的消息收发。
 * 不包含业务逻辑，只做消息路由。
 */

import { state } from './state'
import { toggleSelectionMode } from './actions'
import { vscode } from './vscode-api'

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
      case 'toggleSelectionMode':
        toggleSelectionMode()
        break
      case 'clearSelection':
        state.selectedIds = []
        if (state.selectionMode) toggleSelectionMode()
        break
    }
  })
}


