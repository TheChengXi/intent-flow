# interaction.ts

`src/adapter/vscode/ui/webview/src/renderer/leafer/behaviors/interaction.ts`

**intent:** 指针交互 behavior。 管理 pointer.down/move/up → 拖拽、框选、双击打开文件。 读取 SceneContext 共享状态，通过 ctxRef 回调获取 selection 模块的 doSelectionHitTest。
