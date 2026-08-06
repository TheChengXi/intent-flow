# Later-on 备忘录：pi-adapter-layer-reorg

记录本次需求/设计阶段冒出的、与本次沾边不大或暂不处理的想法。

## 1. mcp / vscode 适配层也有跨层依赖（范围外，同类问题）

- `src/adapter/mcp/tools/CheckFileSizeTool.ts` 直接 import data 层实体
- `src/adapter/vscode/application/dryrun/DryRunManager.ts` 直接 import data 层实体/仓库/服务

本次仅限 pi 适配层，未纳入。若后续做适配层规整，可直接套用本 feature 的验证方式（grep 清零）。

## 2. IAccessPolicy（data）与 IAccessPolicyService（application）疑似重复接口

`data/services/scope/IAccessPolicy.ts` 定义 shouldSkip(name)，`application/services/IAccessPolicyService.ts` 定义同签名接口，且 data 版无代码引用（仅注释提及）。建议后续 feature 确认引用情况后删除 data 版，保留 application 版（ToolAccessGuard 实际使用）。

## 3. AgentRepositoryImpl 测试缺失（建议补充）

`adapter/pi/README.md` 曾声称"AgentRepositoryImpl 集成测试（11 条）"，但仓库中无对应测试文件（已 grep 确认）。README 已改为如实描述实际覆盖（仅 dicontainer.smoke + ToolAccessGuard.integration 共 8 条）。补测建议仍有效：`data/services/agent/AgentRepositoryImpl.test.ts`（构造注入临时目录的测试能力已在 options 参数预留）。

## 4. CoreDIContainer 定位扩展的后续观察

本次把 agentRepo（AgentRepositoryImpl）放入 CoreDIContainer，使其从"纯核心共享"扩展为"data 实现统一组装点"。若后续出现"非 pi 适配器也需要 agent 发现"的需求，应把 DiscoverAgentsUseCase 也纳入 CoreDIContainer；若始终只有 pi 使用，可考虑后续拆出独立的 application 层组装器（如 `AgentDIContainer`）避免核心容器膨胀。

## 5. adapter/pi/index.ts 的 AgentRepositoryImpl 导出移除

index.ts 原导出 SubSkillRepository（现 AgentRepositoryImpl），本次移除（无外部消费者）。若未来有外部脚本/测试需要直接实例化，应从 data 层导出（`data/services/agent/index.ts` 或 data 统一出口），而不是从 adapter 导出。

## 6. 分层规则的机械验证可脚本化

本次验证靠手工 grep。后续可考虑把 `grep -rn "from '.*data/" src/adapter/` 固化为 npm script（如 `check:layering`）并在 CI 中执行，防止回归。
