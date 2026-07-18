import { createApp } from 'vue'
import App from './App.vue'

const app = createApp(App)
app.mount('#app')

// ==================== 浏览器预览模式 ====================
// 当直接打开 http://localhost:5173（不经过 VSCode）时，
// acquireVsCodeApi 不存在，自动加载 demo 数据供 UI 预览
if (typeof window.acquireVsCodeApi !== 'function') {
  console.log('🔧 浏览器预览模式 — 加载 demo 数据')

  // mock 根目录数据
  const demoData = {
    folder: 'src/adapter/vscode',
    subdirectories: ['commands', 'ui', 'services', 'application'],
    files: [
      { file: 'extension.ts' },
      { file: 'VSCodeDIContainer.ts' },
    ],
    groups: [{
      name: '核心能力',
      summary: 'CDD 框架核心功能集合',
      files: [
        { path: 'CommentParser.ts' },
        { path: 'IntentExtractor.ts' },
      ],
    }],
  }

  setTimeout(() => {
    window.dispatchEvent(new MessageEvent('message', {
      data: { type: 'folderData', data: demoData },
    }))
  }, 300)
}
