# 后续想法备忘（interface-layer-reorg）

> 设计阶段识别但**此时不做**的事项，以及未来可能的演进方向。

## 1. TraceDependencyChainUseCase.DependencyInfo 重命名消歧

- **现状**：`src/application/useCases/TraceDependencyChainUseCase.ts` 内部定义的 `DependencyInfo`（layer/filePath/intent）与已删除的 entities 版（type/name/filePath/code/contract）曾经同名。entities 版删除后，它是唯一存活同名类型，但名称仍与"数据层实体"概念混淆。
- **何时做**：TraceDependencyChainUseCase 功能稳定后，重命名为 `TraceDependencyInfo` 或 `LayerDependencyInfo`，消除检索歧义。

## 2. webview 中 renderIntentPackage / intent-package 场景节点

- **现状**：`src/adapter/vscode/ui/webview/src/renderer/leafer/scene.ts` 中仍有 `renderIntentPackage` 渲染分支，但 entities/IntentPackage 已删除，`intent-package` 节点类型在 UI 侧是否还有数据来源存疑（vscode 侧的意图包能力已标注废弃）。
- **何时做**：UI 层（webview）清理另立 feature 时，验证 `intent-package` 节点是否还有上游数据；若无，删除渲染分支。

## 3. 全项目统一 import entities/index.ts

- **现状**：全项目无人 import `entities/index.ts`，全部走直接路径 import（`entities/xxx`）。index.ts 本次已对齐为 9 个活跃导出。
- **何时做**：实体数量继续增长、或需要批量重命名时，可评估迁移到统一出口。当前直接路径无害，不做强制迁移。

## 4. IFileRepository 与 FileSystemRepository / FileWatcher 的关系

- **现状**：`FileSystemRepository` 实现 `IFileRepository`；`FileWatcher` 也依赖 `IFileRepository` 但职责是监听。两者关系仅"共用同一接口"，无继承耦合，暂无不合理。
- **何时做**：若 FileWatcher 未来需要独立于文件系统实现演进（如远程监听），再评估拆分接口。

## 5. extractIntentFromLines 的归属

- **现状**：`IntentExtractor.ts` 瘦身后仅剩 `extractIntentFromLines` 一个导出（约 39 行纯函数），文件名"IntentExtractor"名不副实（不再做文件级提取）。
- **何时做**：若后续有更多意图提取逻辑回归（如新的文件级提取需求），再评估重命名为 `IntentLineParser.ts` 或并入现有模块；当前单函数不值得单独重构。

## 6. 删除文件的 @intent 归档

- **现状**：本次删除的 14 个文件承载了若干 @entity/@contract 语义（如 FileRepository 的 readFile/writeFile 契约注释、PartialContextExtractor 的提取契约）。
- **何时做**：若未来有"从 @intent 重建能力"的需求，可先查 git 历史；本次删除均基于零引用验证，语义已被活跃代码（FileSystemRepository 等）覆盖或不再需要。
