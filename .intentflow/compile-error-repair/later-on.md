# 后续想法备忘（compile-error-repair）

> 设计阶段识别但**此时不做**的事项，以及未来可能的演进方向。

## 1. CapabilityMapPanel 的 webview 侧意图包消息清理

- **现状**：本次仅删除 vscode 侧（CapabilityMapPanel.ts）的 4 处意图包残留引用；webview 前端（`webview/src/core/capability-map/actions.ts` 等）可能仍有 `saveGroups` / `loadGroups` 消息发送点，运行时将落入 default warn 分支。
- **何时做**：webview UI 清理另立 feature 时，验证前端消息发送点与后端消息处理的对应关系，一并删除。

## 2. pi-tui 运行时打包验证

- **现状**：pi-tui 声明到 devDependencies（与 pi-coding-agent 一致）。若 vsce 打包 vscode 扩展时排除 devDependencies 且 pi adapter 的 TUI 组件为运行时必需，打包产物将缺此依赖。
- **何时做**：执行 `vsce package` / `npm run package` 验证打包产物时确认；若必需则提升至 dependencies。

## 3. application/index.ts 整体存废

- **现状**：本次仅删 2 行死导出；该文件全项目无人 import（`export * from './useCases'` 也无消费者）。
- **何时做**：与"统一导出出口"策略（interface-layer-reorg later-on.md 第 3 条）一并决策：保留为统一出口 or 删除整个文件。

## 4. tsc 零错误后的 CI 门槛

- **现状**：项目无 typecheck 脚本（package.json scripts 中无 tsc/typecheck）。
- **何时做**：本 feature 恢复 tsc 零错误后，可加 `"typecheck": "tsc --noEmit"` 脚本并接入 CI/发布前检查，防止回归。

## 5. vi.fn 双泛型写法的同类遗留

- **现状**：全项目仅 ProjectIntentUseCase.test.ts 一个测试文件（ToolAccessGuard.integration.test.ts 无此问题）。
- **何时做**：新测试文件统一使用单函数签名泛型；如需为测试写规范，可沉淀到项目测试约定文档。

## 6. webview 独立 tsconfig 纳入根项目引用

- **现状**：webview 有独立 tsconfig（DOM lib + paths），但根 tsconfig 未通过 references 引用它，导致根 tsc 曾误编译 webview（本 feature 已用 exclude 隔离）。
- **何时做**：若需要"一次 tsc 检查全部构建域"，可评估 `tsc -b` + project references 方案；当前 vite 构建链已覆盖 webview 类型安全（编辑器内），优先级低。
