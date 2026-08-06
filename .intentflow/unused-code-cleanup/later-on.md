# 后续想法备忘（unused-code-cleanup）

> 设计阶段识别但**此时不做**的事项，以及未来可能的演进方向。

## 1. noUnusedLabels / noUncheckedIndexedAccess 等其他严格选项

- **现状**：本次仅开启 noUnusedLocals + noUnusedParameters。TS 还有一系列"严格化"选项未开启（noUnusedLabels、noFallthroughCasesInSwitch、noUncheckedIndexedAccess、exactOptionalPropertyTypes 等）。
- **何时做**：按需逐个评估。noUncheckedIndexedAccess（数组/对象索引访问可能 undefined）对代码影响面最大，开启前需先评估存量影响。

## 2. noUnusedParameters 对"预留参数"语义的规范化

- **现状**：本次用 `_` 前缀标注 7 处预留参数（接口实现/公共 API）。项目无统一的"预留参数"约定文档。
- **何时做**：若预留参数继续增多，可沉淀约定：`_` 前缀 = 签名保留但实现未用；后续实现用到时去掉前缀即可。

## 3. 依赖检查与 unused 检查的组合使用

- **现状**：noUnusedLocals 只能发现"文件内未使用"；跨文件的死模块（如 interface-layer-reorg 清理的 12 个死文件）仍需零引用分析。
- **何时做**：若需要"项目级死代码扫描"，可评估接入 knip / ts-prune 等工具；当前 tsc 零错误 + noUnusedLocals 已覆盖大部分场景。

## 4. 测试文件的未使用代码

- **现状**：本次清理了 2 个测试文件的 5 处未使用（ToolAccessGuard.integration.test.ts 4 处 + ProjectIntentUseCase.test.ts 1 处）。
- **何时做**：新增测试文件时保持同等标准（import 只引入实际使用的 API）。

## 5. ~~searchInWorkspace 的签名瘦身~~（已完成 2026-07-31）

- **现状**：`VSCodeContractSearcher.searchInWorkspace` 的 `_workspaceRoot` 参数为设计冗余（vscode.workspace.findFiles 天然限定工作区）。
- **处理**：进一步核查发现整个 `VSCodeContractSearcher` 类全项目零引用（仅 CodeParserRepositoryImpl 的 throw 消息字符串提及）→ 整个死文件删除；throw 消息同步修正（移除过时指引）。
