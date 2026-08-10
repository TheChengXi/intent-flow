# dryrun-use-case-extraction 关账报告

## 1. 项目概览
将 DryRunManager 的业务逻辑下沉到 application 层（新增 DryRunUseCase），消除 vscode adapter 对 data 层的直接依赖，恢复 adapter → application → data 依赖方向。

## 2. 计划 vs 实际

| 计划功能 | 状态 | 说明 |
|---|---|---|
| DryRunUseCase 下沉（状态切换、拦截记录、监听器） | ✅ 完成 | `src/application/useCases/DryRunUseCase.ts`，7 个单测覆盖 |
| IDryRunRepository 接口化（零依赖，可注入） | ✅ 完成 | `src/data/repositories/IDryRunRepository.ts`，DryRunRepository 补 implements |
| DryRunManager 瘦身（薄委托，零 data 依赖） | ✅ 完成 | 公开 API 与重构前完全一致，UI 三组件零改动 |
| 实体类型经 UseCase re-export | ✅ 完成 | `export type { DryRunConfig, DryRunRecord }` |
| VSCodeDIContainer 装配（激活预留容器） | ✅ 完成 | `dryRunUseCase` 显式注入 data 实现 |
| 架构检查可机械验证 | ✅ 完成 | grep 断言无 data import，PASS |

## 3. 关键决策

1. **移除 DryRunUseCase 自持单例（getInstance/reset）**——设计文档原定"单例 + 工厂双形态"，实现时发现 `getInstance()` 内运行时 `new DryRunRepository()` 会让 vitest（无 vscode 包）加载整条 vscode 依赖链而崩溃。**修正**：单例角色由 VSCodeDIContainer（本身是单例容器）承担，UseCase 仅保留工厂 `createDryRunUseCase()`；DryRunUseCase 模块因此零运行时 vscode 依赖，测试干净。@intent 未涉及单例形态，无需同步。
2. **VSCodeDIContainer 显式装配**：`new DryRunRepository() + new DryRunStatisticsService()` 注入工厂，而非 UseCase 内部自建——与"构造器注入"决策一致。

## 4. 经验记录

- **有效做法**：接口化（IDryRunRepository 零依赖）使 application 层代码在非 vscode 环境可测——测试无需 `vi.mock('vscode')`，用 Fake 替代系统边界（文件 IO），内部协作者（统计服务）用真实纯函数。此模式可复用到其他"data 层依赖外部环境"的用例。
- **踩坑**：设计阶段未预见到"UseCase 自持单例 + 运行时 new 依赖"会把 vscode import 拉进测试链。教训：**测试链上任何运行时 import 都会被执行**，application 层模块应默认 type-only import 外部环境依赖，运行时装配一律放 adapter 容器侧。
- **工具反馈**：sub-agent 通道（test-writer/code-writer）在当前环境不可用（list_agents 返回空、agent_chat 报 Agent not found），主会话降级为 TDD 精神执行。logs/ 报告由主会话代写，格式与 skill 约定一致。

## 5. 后续待办

- **立即跟进**：无未完成项。
- **长期备忘**（见 `D:/w_dev/intent-flow/.intentflow/dryrun-use-case-extraction/later-on.md`）：
  - DryRunRepository 的 vscode 依赖抽离（workspaceRoot 注入）——触发：DryRun 需脱离 vscode 消费时
  - intercept() 无调用方（hook 已废弃）——触发：恢复请求拦截链路时
  - DryRunUseCase 迁入 CoreDIContainer 的条件——触发：MCP/CLI 消费 DryRun 时（先决：vscode 依赖抽离）
  - UI 组件直连 UseCase（去掉 DryRunManager 中转）——触发：UI 本身重构时

## 6. 开发工作流反馈

- **流程断点**：execute skill 强依赖 sub-agent（test-writer/code-writer），但本环境 list_agents 为空。建议：skill 明确"sub-agent 不可用时的降级路径"（主会话 TDD 的判定标准与交付物格式），或排查 agent 注册机制（sub-skill 目录存在但未被发现）。
- **工具链建议**：vitest 对"模块运行时 import 外部环境包"的报错信息清晰（Cannot find package 'vscode'），可作为架构违规的快速检测手段，建议纳入集成验证命令。

## 7. 结论

- **当前状态**：✅ 可发布。验证证据：tsc 0 错误；全量 138 测试通过（循环 3 次稳定）；架构 grep 断言 PASS；MCP 构建产物 0 处 vscode 引用（设计决策 1 的隔离目标实证）。
- **建议下一步**：VS Code 扩展宿主手动回归（toggle 命令 → 状态栏切换 → 输出通道），验证 UI 链路行为与重构前一致；随后可进入 mcp-server-stability 的实现。
