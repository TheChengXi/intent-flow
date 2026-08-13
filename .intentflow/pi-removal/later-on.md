# 后续想法备忘：pi-removal

> 设计阶段识别但**此时不做**的事项。只记录想法，不做任何设计预留——需要时直接实现。

## 想法列表

### L01：CLI 进一步废弃（`iflow` 二进制）
- 现状：README 自嘲"CLI 基本没卵用"，CLI 目前保留 4 条命令（check-file-size/trace-dependency-chain/project-intent/list-folder-intents），全部经 CoreDIContainer 跑同一批用例，与 MCP 工具完全重叠。
- 何时做：当确认 MCP 成为唯一消费形态、或 CLI 无人使用时。
- 备注：与 mcp-tools-removal 的 L01（移除整个 MCP 适配层）方向相反——两者只能二选一，取决于实际消费形态。

### L02：从 archive 复活 agent 域组件的成本
- 现状：DiscoverAgentsUseCase/AgentRequestUseCase/ScopePolicy/守卫开关/AgentRepositoryImpl/scope 策略等已随 pi 入档 `.archive/retired_pi.008/`。若未来某适配器（如新的扩展宿主）需要子 agent 调度或访问策略，需从 archive 重新提取并重新接线 CoreDIContainer。
- 何时做：出现需要子 agent 调度/工具守卫的新宿主时。
- 备注：提取时注意 IAgentMessagingService 是 pi 平台实现（AgentMessagingService/RpcProcessPool），不能直接复用，需为新宿主重写实现。

### L03：README 技能路径的单一事实源
- 现状：README 中四阶段 skill 路径从 `.pi/skills/` 改指 `.dsh/skills/`，但 README 仍是手工维护的路径清单，与 `.dsh/skills/` 实际目录存在漂移风险。
- 何时做：README 大改版时。
- 备注：可考虑 README 不再列举 skill 文件路径，只描述工作流概念。

### L04：`scripts/` 目录 git 忽略策略
- 现状：`.gitignore` 中 `scripts/*` 全忽略 + 白名单 `!scripts/fetch-release.js`；本次删白名单后 `scripts/` 下所有脚本（mcp-stress-test.mjs、deploy-pi.js 已移走）均不入库，仅 fetch-release 曾入库。仓库实际"脚本即本地工具"。
- 何时做：若有脚本需要随仓库分发（如 CI 用）时。
- 备注：`scripts/mcp-stress-test.mjs` 是本地压测脚本（gitignored），本次不动；若未来要入库需显式白名单。

## 与当前设计的关系（轻量提示）

- L01/L02 是方向性演进，当前 CoreDIContainer 仅保留 CLI/MCP 共享的 4 个用例，未为任一方向预留接口——届时直接调整即可。
- L03/L04 是文档/仓库策略层面，与本次代码归档无耦合。
