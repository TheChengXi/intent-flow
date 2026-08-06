# composable.ts

`src/adapter/vscode/ui/webview/src/pages/capability-map/composable.ts`

**intent:** 能力地图页面胶水层。 连接 core（状态管理）与 renderer（渲染引擎实例），负责响应式渲染调度。 所有函数接收 scene（SceneManager 实例）作为参数，不依赖模块级变量。
