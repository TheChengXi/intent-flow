# event-hub.ts

`src/adapter/vscode/ui/webview/src/renderer/leafer/behaviors/event-hub.ts`

**intent:** 轻量事件通道实现。 behavior 模块通过 hub.emit() 发出事件，UI 组件通过 hub.subscribe() 订阅。 不依赖 Vue、不依赖 Leafer，纯函数式。
