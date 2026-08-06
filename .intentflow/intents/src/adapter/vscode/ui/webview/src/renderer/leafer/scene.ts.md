# scene.ts

`src/adapter/vscode/ui/webview/src/renderer/leafer/scene.ts`

**intent:** Leafer 渲染引擎的 SceneManager 工厂函数。 每次调用 createSceneManager() 返回一个新实例。 内部将功能拆分为三个 behavior 模块（interaction / selection / zoom）， 通过共享 SceneContext 保持状态一致。
