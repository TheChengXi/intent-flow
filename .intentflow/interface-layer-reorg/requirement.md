# 需求文档：接口层重整（interface-layer-reorg）

## 项目意图

删除 src/data/entities + src/data/repositories 中已废弃/死链的接口定义，收敛 services 层的同名重复定义，使接口层（entities）成为数据层接口的唯一出口。

## 功能清单

1. **删除完全废弃实体**：`IntentPackage.ts`（全项目零引用，多处 @warn 标注已废弃）
2. **删除死链对 1**：`CallDependency.ts` + `ICallGraphAnalyzer.ts`（接口只被死接口引用，整条链无实现/无使用）
3. **删除死链对 2**：`Errors.ts` + `FileRepository.ts`（错误类只被死模块引用；FileRepository 为纯函数模块，全项目零引用）
4. **删除死文件与死实体（修正自"收敛重复定义"）**：设计阶段验证发现 5 对重复定义的载体文件（PartialContextExtractor / FullContextExtractor）整文件零引用，正确动作是整文件删除而非收敛；entities 版 5 个死实体一并删除；TypeDefinition 无冲突保留
5. **IntentExtractor 瘦身**：保留活的 extractIntentFromLines，删除其余死导出
6. **重整 index.ts**：导出清单与实际引用对齐（删除死实体的导出，补全活跃实体）
7. **特例处理**：`TraceDependencyChainUseCase` 的 `DependencyInfo` 为字段语义完全不同的独立类型，不合并

## 核心功能

### 核心功能1：死代码删除
- **能力**：系统能够删除接口层中无存活引用链的文件，且不破坏任何现存功能
- **业务价值**：消除误导性接口定义，降低新人理解成本与检索噪音

### 核心功能2：死代码清理（修正自"重复定义收敛"）
- **能力**：系统能够删除 services 层内嵌同名接口定义及其死载体文件（PartialContextExtractor / FullContextExtractor 整文件），entities 层对应死实体一并删除
- **业务价值**：接口定义单一来源（TypeDefinition 唯一保留），消除"改一处漏一处"的风险与误导性死代码

### 核心功能3：导出出口重整
- **能力**：系统能够使 `entities/index.ts`、`repositories/index.ts` 的导出与实际引用保持一致
- **业务价值**：避免死导出继续被误用，为后续统一出口铺路

## 业务规则

### 删除前置条件
- **场景**：删除 entities/repositories 中的任何文件前
- **行为**：必须确认 src 全范围（含 *.test.ts、webview、README/docs）对该文件**零引用**；若仅被同样将删除的文件引用，视为死链可连带删除
- **异常处理**：发现任何遗漏引用 → 停止删除该文件，标记并人工确认

### 死文件删除优先于收敛
- **场景**：services 层文件内嵌定义与 entities 层同名接口并存
- **行为**：先验证内嵌定义**载体文件本身**是否存活；载体文件死 → 整文件删除（entities 版无引用则一并删除，不做收敛）；载体文件活 → 才考虑收敛（本次仅 TypeDefinition 存活且无冲突，零改动）
- **异常处理**：验证发现载体文件有活引用 → 恢复收敛流程，逐对确认字段一致性

### 编译与回归验证
- **场景**：每完成一个删除/收敛批次后
- **行为**：必须执行 `npx tsc --noEmit` 确认零类型错误；全部完成后执行 `npm test`（vitest）确认测试通过
- **异常处理**：类型错误 → 回查遗漏引用，修复后再继续

## 预设测试

> 从用户视角可执行的测试步骤，验证功能是否符合预期。

### 前置条件
- Node.js + 依赖已安装（`npm install` 完成）
- 当前代码基线可编译（`npx tsc --noEmit` 无错误）

### 测试步骤

1. **[编译验证]**：运行 `npx tsc --noEmit`
   **预期结果**：零类型错误，退出码 0

2. **[残留引用检查]**：运行
   `grep -rn "IntentPackage\|ICallGraphAnalyzer\|CallDependency\|entities/Errors\|FileRepository\|PartialContextExtractor\|FullContextExtractor" src --include="*.ts" | grep -v "webview/node_modules"`
   **预期结果**：仅剩预期保留项（如 TraceDependencyChainUseCase 注释中的 @warn 提及、webview 的 renderIntentPackage），无代码级引用

3. **[死定义检查]**：运行
   `grep -rn "interface CodeSnippet\|interface DependencyInfo\|interface DependencyBranch\|interface IntentResult\|interface PartialContextResult" src --include="*.ts"`
   **预期结果**：src 全范围（含 services）无这些 interface 定义，仅剩 application 层独立的 DependencyInfo（特例）

4. **[回归测试]**：运行 `npm test`
   **预期结果**：全部测试通过（ProjectIntentUseCase.test.ts、ToolAccessGuard.integration.test.ts 等）

5. **[功能冒烟]**：运行任一依赖实体接口的命令（如 `npx tsx src/adapter/cli/index.ts check-file-size src/data/entities/index.ts` 或 MCP trace-dependency-chain）
   **预期结果**：命令正常输出，无 import 运行时错误

### 异常场景

- **[遗漏引用]**：tsc 报错指向已删除文件 → 说明存在未发现的引用，恢复该文件或修正引用方，不得绕过编译
- **[字段不一致]**：收敛过程中发现两版定义有差异 → 暂停该对收敛，记录差异，与用户确认后再处理
- **[测试失败]**：vitest 失败 → 定位失败用例与本次改动的关联，修复或回滚该批次

## 边界收束

**此时必做**：
- 删除 D 类（IntentPackage）与 B 类死链（CallDependency + ICallGraphAnalyzer、Errors + FileRepository）
- 同步更新 entities/index.ts 与 repositories/index.ts 导出
- 收敛 6 对重复定义（entities 为唯一出口）
- 每批次 tsc 验证 + 收尾 vitest 回归

**此时不做**：
- `TraceDependencyChainUseCase` 的 `DependencyInfo` 重命名/合并 — 字段语义完全不同（layer/filePath/intent vs type/name/filePath/code/contract），是独立类型；等该 UseCase 功能稳定后再考虑是否更名消歧
- webview 中 `renderIntentPackage` 清理 — 是 UI 场景节点类型（leafer scene 渲染概念），与 entities/IntentPackage 无关，不在 data 层范围
- 全项目统一改为 import `entities/index.ts` — 直接路径 import 是当前主流且无实际危害，全面迁移风险大收益小；仅在 index.ts 导出对齐后视需要再议
- 更广泛的分层架构调整（如 IFileRepository / FileSystemRepository 的关系优化）— 超出本次"删除+收敛"目标，需另立 feature

## 执行批次规划（供后续迭代参考）

| 批次 | 内容 | 验证 |
|---|---|---|
| 1 | 删除 IntentPackage.ts | tsc |
| 2 | 删除 ICallGraphAnalyzer.ts + FileRepository.ts + repositories/index 同步 | tsc |
| 3 | 删除 CallDependency.ts + Errors.ts + entities/index 移除 CallDependency | tsc |
| 4 | 删除 PartialContextExtractor.ts + FullContextExtractor.ts | tsc |
| 5 | IntentExtractor.ts 瘦身 | tsc |
| 6 | 删除 entities 5 死实体 + entities/index 补全 DryRunConfig/DryRunRecord | tsc |
| 7 | 全量回归 | tsc + vitest + 冒烟 |

> 批次规划详见 design.md（含删除顺序约束：先删引用方、后删被引用方）
