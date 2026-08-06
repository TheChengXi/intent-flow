# 设计文档：接口层重整（interface-layer-reorg）

> 基于 `.intentflow/interface-layer-reorg/requirement.md`，遵循 IntentFlow 三层架构（data / application / adapter）。

## 0. 与需求文档的关键偏差（设计阶段新发现）

需求文档假设 services 层存在 6 对"活跃的"重复定义需要收敛。设计阶段逐一验证引用链后发现：

- `PartialContextExtractor.ts`、`FullContextExtractor.ts` **整文件零引用**（死文件）
- 6 对重复定义中 5 对的 services 内嵌版随死文件删除，entities 版同样无人引用 → **一并删除，无需收敛**
- 唯一活着的 `TypeDefinition`：entities 版被 `ICodeParserRepository` 使用，services 内嵌版随死文件消失，无冲突

**净效果：活跃代码零 import 修改，全部为纯删除 + 2 个 index.ts 对齐 + 1 个文件瘦身。**

---

## 1. 模块清单

| 模块 | 层级归属 | 职责 | 依赖 |
|---|---|---|---|
| `src/data/entities` | data | 类型定义唯一出口（清理后 9 个导出） | 无（纯类型） |
| `src/data/repositories` | data | 仓储接口定义（清理后 6 个文件） | entities |
| `src/data/services/codeContext` | data | 代码上下文提取实现（删 2 死文件、瘦身 1 文件） | entities、tree-sitter、cache |
| `src/data/services/cache` | data | 缓存实现（不受影响） | entities |
| `src/data/services/codeParser` | data | 代码解析实现（不受影响） | entities |
| `src/application/useCases` | application | 用例编排（仅 ProjectIntentsToFilesUseCase 依赖瘦身后的 extractIntentFromLines） | data/repositories、data/entities |
| `src/adapter/*` | adapter | 用户交互（cli/mcp/pi/vscode，不受影响） | application |

## 2. 依赖链

```
adapter (cli/mcp/pi/vscode)
    ↓
application/useCases
    ↓
data/repositories（接口） ←→ data/services（实现）
    ↓
data/entities（类型唯一出口）
```

**跨层依赖体检（已验证通过）**：
- data 层无任何反向依赖 application/adapter ✅
- application 层无任何反向依赖 adapter ✅
- 本次改动不改变任何依赖方向

## 3. 本次设计决策

### 决策 1：以「引用链存活」为唯一删除判据
- 判据：文件零引用，或仅被同样删除的文件引用（死链连带删除）
- 15 个删除文件全部逐一验证（含 test/webview/docs），无遗漏引用

### 决策 2：C 类处理从「收敛」改为「整文件删除」
- 5 对重复定义（CodeSnippet / DependencyInfo / DependencyBranch / IntentResult / PartialContextResult）的 services 内嵌版与 entities 版**全部删除**
- `TypeDefinition` 保留 entities 版（活链：ICodeParserRepository → CodeParserRepositoryImpl → TraceDependencyChainUseCase），无冲突无需改动

### 决策 3：IntentExtractor 瘦身而非删除
- **保留**：`extractIntentFromLines`（活，被 ProjectIntentsToFilesUseCase 调用，纯函数无依赖）
- **删除**：`IntentResult` 接口、`extractIntentFromFile`、`extractIntentWithTreeSitter`、`findIntentInComments`、`extractIntentFromCommentBlock`、`extractIntentWithRegex`（全部只被死文件/死函数引用）、4 个 import（fs / path / TreeSitterManager / LanguageConfig）
- 效果：266 行 → 约 39 行，只留活代码

### 决策 4：index.ts 出口对齐
- `entities/index.ts`：移除 6 个死导出（CallDependency / CodeSnippet / DependencyInfo / DependencyBranch / IntentResult / PartialContextResult），补全 2 个活跃但缺失的导出（DryRunConfig / DryRunRecord）→ 目标 9 个导出
- `repositories/index.ts`：移除 `ICallGraphAnalyzer` 导出（FileRepository 本就不在导出中）
- 注：全项目当前无人 import `entities/index.ts`（全部直接路径），本次仅对齐导出清单，不强制迁移（见 later-on.md）

### 决策 5：保留特例
- `TraceDependencyChainUseCase.DependencyInfo`（application 层）：字段语义与 entities 版完全不同（layer/filePath/intent vs type/name/filePath/code/contract），是独立类型。entities 版删除后它成为唯一存活同名类型 → 记入 later-on.md 待重命名消歧

### 关键接口约束
1. 删除顺序约束：**必须先删引用方，再删被引用方**（否则 tsc 中断引用报错）——见批次规划
2. 禁止新增任何"以防万一"的兜底代码（本次为纯删除型改动）

## 4. 改动点清单

### 删除文件（12 个）

| # | 文件 | 类别 | 判据 |
|---|---|---|---|
| 1 | `src/data/entities/IntentPackage.ts` | D 完全废弃 | 零引用 + 多处 @warn 标注废弃 |
| 2 | `src/data/repositories/ICallGraphAnalyzer.ts` | B 死链 | 零实现/零使用 |
| 3 | `src/data/repositories/FileRepository.ts` | B 死链 | 零引用（纯函数模块） |
| 4 | `src/data/entities/CallDependency.ts` | B 死链 | 仅被 #2 引用 |
| 5 | `src/data/entities/Errors.ts` | B 死链 | 仅被 #3 引用 |
| 6 | `src/data/services/codeContext/PartialContextExtractor.ts` | C 死文件 | 整文件零引用 |
| 7 | `src/data/services/codeContext/FullContextExtractor.ts` | C 死文件 | 整文件零引用 |
| 8 | `src/data/entities/CodeSnippet.ts` | C 死实体 | 零引用（内嵌版随 #6 删除） |
| 9 | `src/data/entities/DependencyInfo.ts` | C 死实体 | 零引用 |
| 10 | `src/data/entities/DependencyBranch.ts` | C 死实体 | 零引用 |
| 11 | `src/data/entities/IntentResult.ts` | C 死实体 | 零引用 |
| 12 | `src/data/entities/PartialContextResult.ts` | C 死实体 | 零引用 |

### 修改文件（3 个）

| # | 文件 | 改动 |
|---|---|---|
| 13 | `src/data/services/codeContext/extractors/IntentExtractor.ts` | 瘦身：删 6 个死导出/私有函数 + 4 个 import，保留 extractIntentFromLines |
| 14 | `src/data/entities/index.ts` | 移除 6 个死导出，补 DryRunConfig/DryRunRecord，目标 9 个 |
| 15 | `src/data/repositories/index.ts` | 移除 ICallGraphAnalyzer 导出 |

### 集成验证阶段附加修复（1 个，基线 bug）

| # | 文件 | 改动 | 原因 |
|---|---|---|---|
| 16 | `src/adapter/cli/commands/index.ts` | 移除废弃的 `intent-package` 命令条目 | 基线 bug：命令表引用从未定义的 `intentPackageHandler`，导致 CLI 启动即崩，阻塞本 feature 冒烟验证；与意图包废弃清理目标一致 |

### 新增文件
无

## 5. 批次规划（依赖顺序约束）

> 每批次独立可验证：`npx tsc --noEmit` 零错误。

| 批次 | 内容 | 删除顺序依据 |
|---|---|---|
| 1 | 删 `IntentPackage.ts` | 无引用方，任意顺序 |
| 2 | 删 `ICallGraphAnalyzer.ts` + `FileRepository.ts` + `repositories/index.ts` 同步 | 引用方先删 |
| 3 | 删 `CallDependency.ts` + `Errors.ts` + `entities/index.ts` 移除 CallDependency 导出 | 被引用方后删（引用方已在批次 2 删除） |
| 4 | 删 `PartialContextExtractor.ts` + `FullContextExtractor.ts` | services 死文件先删 |
| 5 | `IntentExtractor.ts` 瘦身 | 独立 |
| 6 | 删 entities 5 个死实体（CodeSnippet/DependencyInfo/DependencyBranch/IntentResult/PartialContextResult）+ `entities/index.ts` 补全 DryRunConfig/DryRunRecord | 被引用方最后删（引用方已在批次 4 删除） |
| 7 | 全量回归：`tsc --noEmit` + `npm test` + grep 残留检查 + 冒烟 | — |

## 6. 验证策略

- **每批次**：`npx tsc --noEmit` 零错误
- **批次 7 回归**：
  - `npm test`（vitest：ProjectIntentUseCase.test.ts、ToolAccessGuard.integration.test.ts 等）
  - grep 残留：`grep -rn "IntentPackage\|ICallGraphAnalyzer\|CallDependency\|entities/Errors\|FileRepository\|PartialContextExtractor\|FullContextExtractor" src --include="*.ts"`（排除 webview/node_modules，允许 @warn 注释提及）
  - 冒烟：`check-file-size` 命令或 MCP trace-dependency-chain 正常输出
