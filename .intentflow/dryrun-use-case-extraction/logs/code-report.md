# TDD 实现报告：dryrun-use-case-extraction

> 说明：sub-agent 通道不可用（list_agents 为空），由主会话以 TDD 精神执行（测试先行 → 实现 → 验证）。

## 文件路径与实现状态

| 文件 | 状态 | 说明 |
|---|---|---|
| `src/data/repositories/IDryRunRepository.ts` | ✅ 新增 | 零依赖接口（type-only import），save 签名与 DryRunRepository 现状一致 |
| `src/data/repositories/DryRunRepository.ts` | ✅ 修改 | 补 `implements IDryRunRepository`，实现逻辑不动 |
| `src/application/useCases/DryRunUseCase.ts` | ✅ 新增 | 业务逻辑单一归属点：toggle/intercept/三类监听器；类型 re-export |
| `src/application/useCases/DryRunUseCase.test.ts` | ✅ 新增 | 7 个测试全绿 |
| `src/application/useCases/index.ts` | ✅ 修改 | 聚合导出 DryRunUseCase |
| `src/adapter/vscode/VSCodeDIContainer.ts` | ✅ 修改 | 装配 dryRunUseCase（显式注入 DryRunRepository + DryRunStatisticsService） |
| `src/adapter/vscode/application/dryrun/DryRunManager.ts` | ✅ 修改 | 瘦身为薄委托，零 data 层 import |

## GREEN 验证结果
- `npx vitest run src/application/useCases/DryRunUseCase.test.ts`：7/7 通过
- `npx tsc --noEmit`：0 错误
- 全量 `npx vitest run`：10 文件 / 138 测试通过（循环 3 次稳定）

## 实现过程中的决策点（相对 design.md 的细化）

1. **移除 DryRunUseCase 自持单例（getInstance/reset）**：设计文档决策 4 原写"单例 + 工厂双形态"。实现时发现 `getInstance()` 内运行时 `new DryRunRepository()` 会使测试环境（vitest 无 vscode 包）加载整条 vscode 依赖链而崩溃。**修正**：单例角色由 VSCodeDIContainer（本身就是单例容器）承担，UseCase 只保留 `createDryRunUseCase()` 工厂；DryRunUseCase 模块因此零运行时 vscode 依赖（type-only import），测试干净，也强化了设计决策 1 的隔离目标。@intent 未提及单例形态，无需同步修改。

2. **VSCodeDIContainer 装配方式**：采用"显式 new data 实现 + createDryRunUseCase 注入"，而非 UseCase 内部自建——与决策 2（构造器注入）一致。

## 疑虑或卡点
- 无遗留卡点。DryRunRepository 的 vscode 依赖（workspace.workspaceFolders）按设计保留在 data 层内部，已记录至 later-on.md。
