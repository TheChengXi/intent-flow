# 设计文档：未使用代码清理（unused-code-cleanup）

> 基于 `.intentflow/unused-code-cleanup/requirement.md`。已有项目，顺应原有结构；本次改动为编译选项开启 + 删除型清理，不改变任何依赖方向。

## 0. 设计前置验证结论

| 验证项 | 结论 |
|---|---|
| 开启选项后存量规模 | 29 个错误（TS6133 × 27 + TS6196 × 2）/ 19 文件 |
| ToolAccessGuard 构造函数 | 无副作用（仅存 accessPolicy 字段），guard 声明可安全删除 |
| TypeScriptResolver 79 行 | 方法内遮蔽声明（顶部已有 `import * as path`），可删 |
| started / stdout / mockCtx | 纯声明残留（Date.now 无副作用；stdout 连写操作都没有），可删 |
| getBuiltinTypes 调用方 | 1 处（TypeReferenceExtractor 传 'typescript'）→ 保留签名用下划线 |
| formatUsage / ensureVisible 调用处 | 2 处 / 3 处（私有，删参数连带改调用） |

## 1. 模块清单

| 模块 | 层级归属 | 改动 |
|---|---|---|
| `tsconfig.json` | 构建配置 | 开启 noUnusedLocals + noUnusedParameters |
| `src/data/*`（5 文件） | data | 删未使用 import/变量，参数下划线（7 处） |
| `src/adapter/vscode/*`（4 文件） | adapter | 同上（7 处） |
| `src/adapter/pi/*`（10 文件） | adapter | 同上（14 处） |
| `src/application/useCases/*.test.ts`（1 文件） | application | 删未使用类型 import（1 处） |

## 2. 依赖链

本次改动零依赖方向变化；受影响的是"编译期检查域"：根 tsc 从"只查类型"扩展为"查类型 + 查未使用代码"，覆盖 data/application/adapter 三层（webview/src 已隔离）。

## 3. 本次设计决策

### 决策 1：编译选项开启（tsconfig 2 行）
- `noUnusedLocals: true` + `noUnusedParameters: true`
- 位置：`compilerOptions` 中 `strict` 之后
- 影响：未来所有新代码的未使用声明将被编译期拦截（预期收益，防回归）

### 决策 2：处理方式三分法（29 处的逐个判定）
| 方式 | 数量 | 适用 |
|---|---|---|
| **删除** | 20 处 | 未使用 import（9）、未使用局部变量（9）、解构未用字段（1）、方法内遮蔽声明（1） |
| **下划线前缀** | 7 处 | 接口实现/公共 API/回调签名的未使用参数 |
| **删参数 + 改调用处** | 2 处 | 私有函数/方法的未使用参数（formatUsage、ensureVisible） |

### 决策 3：下划线前缀适用清单（签名必须保留的场景）
| 文件 | 参数 | 理由 |
|---|---|---|
| `CacheRepositoryImpl.set` | `_ttl` | ICacheRepository 接口签名（ttl 预留） |
| `CodeParserRepositoryImpl.searchContract` | `_functionName` `_workspaceRoot` | ICodeParserRepository 接口实现（方法体为 throw 占位） |
| `LanguageConfig.getBuiltinTypes` | `_language` | 公共静态 API，调用方传参（TypeReferenceExtractor） |
| `CheckFileSizeCommand`（×2） | `_progress` | withProgress 回调签名由 vscode API 定义 |
| `LogPanel.render` | `_isFocused` | 公共渲染 API，外部调用传参 |
| `SubAgentView.wrapLine` | `_themeFg` | 私有方法但调用处多，下划线最小 diff |
| `VSCodeContractSearcher.searchInWorkspace` | `_workspaceRoot` | 公共静态方法（无调用方，签名保守保留） |

### 决策 4：删参数连带改调用处
- `SpawnAgentTool.formatUsage(result, theme)` → `formatUsage(result)`，改 2 处调用；**连锁检查**：调用处 theme 变量若仅用于 formatUsage 可能随之变未使用，需一并处理
- `AgentListPanel.ensureVisible(total)` → `ensureVisible()`，改 3 处调用

### 决策 5：副作用逐个确认结论（可安全删除的声明）
- `const started = Date.now()` — 无副作用，未读取（durationMs 由其他路径计算）
- `let stdout = ''` — 连写入都不存在（否则不算"never read"）
- `const mockCtx = {...}` — 纯对象字面量
- `const guard = new ToolAccessGuard(policy)` — 构造函数无副作用，测试断言不依赖 guard 实例

### 关键接口约束
1. 不改变任何运行时行为（删除均为"未读取"声明）
2. 接口签名（IFileRepository/ICacheRepository/ICodeParserRepository）**零改动**——未使用参数只在实现侧下划线
3. 测试文件与源码同等规则

## 4. 改动点清单

### 修改文件（20 个）

| # | 文件 | 改动 |
|---|---|---|
| 1 | `tsconfig.json` | 开启 noUnusedLocals + noUnusedParameters |
| 2 | `src/data/repositories/ICodeParserRepository.ts` | 删 TypeDefinition import |
| 3 | `src/data/services/cache/CacheRepositoryImpl.ts` | set 参数 ttl → `_ttl` |
| 4 | `src/data/services/codeContext/extractors/import/resolvers/TypeScriptResolver.ts` | 删 79 行 `const path = require('path');` |
| 5 | `src/data/services/codeParser/CodeParserRepositoryImpl.ts` | 删 ContractSearcher import；searchContract 参数下划线 ×2 |
| 6 | `src/data/services/tree-sitter/LanguageConfig.ts` | getBuiltinTypes 参数 `_language` |
| 7 | `src/adapter/vscode/application/dryrun/DryRunManager.ts` | import 只留 createDryRunRecord |
| 8 | `src/adapter/vscode/commands/CheckFileSizeCommand.ts` | 删 container 行；progress ×2 → `_progress` |
| 9 | `src/adapter/vscode/commands/RemoveFromIntentsCommand.ts` | 删 VSCodeDIContainer import |
| 10 | `src/adapter/vscode/services/VSCodeContractSearcher.ts` | workspaceRoot → `_workspaceRoot` |
| 11 | `src/adapter/pi/repositories/SubSkillRepository.ts` | 删 basename import |
| 12 | `src/adapter/pi/runtime/RpcProcessPool.ts` | 删 started 行；解构 `[, pending]` |
| 13 | `src/adapter/pi/runtime/SubProcessRunner.ts` | 删 readFile import；删 stdout 行 |
| 14 | `src/adapter/pi/tools/SpawnAgentTool.ts` | formatUsage 删 theme 参数 + 改 2 处调用（连锁检查） |
| 15 | `src/adapter/pi/tools/ToolAccessGuard.integration.test.ts` | 删 ToolCallEventResult/beforeEach import；删 mockCtx/guard 声明 |
| 16 | `src/adapter/pi/tui/AgentListPanel.ts` | 删 visibleWidth import；ensureVisible 删 total 参数 + 改 3 处调用 |
| 17 | `src/adapter/pi/tui/LogPanel.ts` | 删 truncateToWidth import；render 参数 `_isFocused` |
| 18 | `src/adapter/pi/tui/SubAgentView.ts` | wrapLine 参数 `_themeFg` |
| 19 | `src/application/useCases/ProjectIntentUseCase.test.ts` | import 只留 ProjectIntentResult |

### 新增文件
无

## 5. 批次规划（错误数单调递减）

| 批次 | 内容 | 错误数 |
|---|---|---|
| 1 | tsconfig 开启 2 选项 + tsc | 0 → 29（确认存量全暴露） |
| 2 | data 层 5 文件（7 处） | 29 → 22 |
| 3 | vscode 层 4 文件（7 处） | 22 → 15 |
| 4 | pi 层 10 文件（14 处）+ application 1 文件（1 处） | 15 → 0 |
| 5 | 全量回归：tsc 零错误 + vitest 29/29 + CLI/pi 冒烟 | — |

## 6. 验证策略

- **每批次**：`npx tsc --noEmit` 错误数对比（单调递减至 0）
- **批次 5 回归**：
  - `npm test`（vitest）29/29 —— 证明清理零行为影响
  - 选项生效验证：临时 `const unused = 1;` 应报 TS6133，移除后恢复
  - CLI 冒烟：check-file-size 正常
  - pi 冒烟：pi-tui 模块可解析 + SpawnAgent 相关命令不崩（改动最多层）
