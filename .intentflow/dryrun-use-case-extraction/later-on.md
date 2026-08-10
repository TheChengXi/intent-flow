# 后续想法：dryrun-use-case-extraction

本文件记录本次设计范围内**明确不做**、但值得跟踪的后续想法。每一项标注触发条件，条件满足前不进入任何迭代。

---

## 1. DryRunRepository 的 vscode 依赖抽离
- **想法**：`DryRunRepository` 顶层 `import vscode`（`workspace.workspaceFolders` 取工作区根）——data 层依赖 vscode 环境，意味着 DryRun 能力无法脱离 vscode 使用。可改为构造器注入 workspaceRoot（或工作区解析函数），使 data 层环境无关
- **触发条件**：DryRun 能力需要被 CLI / 非 vscode 环境消费时；或 data 层统一做环境无关化时
- **现状**：本次只修 adapter → data 依赖方向，vscode 依赖在 data 层内部，不阻塞

## 2. DryRunUseCase 迁移 CoreDIContainer 的条件
- **想法**：本次 DryRunUseCase 装配在 VSCodeDIContainer（因 DryRunRepository 依赖 vscode）。若未来 DryRun 需要被 MCP 工具 / CLI 命令消费，应先完成第 1 项（vscode 依赖抽离），再迁入 CoreDIContainer 统一装配
- **触发条件**：出现 MCP/CLI 侧 DryRun 需求时（先决条件：第 1 项完成）
- **现状**：vscode 独占场景，VSCodeDIContainer 足够

## 3. intercept() 无调用方
- **想法**：`DryRunManager.intercept()`（统计 → 记录 → 保存链路）目前**没有任何调用方**——原 Hook 拦截链路已废弃（`.archive/retired-vscode.005`）。本次下沉保留了完整能力，但无人触发。若未来要恢复"拦截 AI 请求"链路，需先恢复 hook 或引入新的触发点（如命令/文件保存钩子）
- **触发条件**：恢复请求拦截能力时
- **现状**：能力保留不丢，UI 降级路径（onError）已被输出通道订阅，无运行时影响

## 4. DryRunConfig.showStatistics 未被消费
- **想法**：`DryRunConfig` 有 `showStatistics` 配置项，但现状代码（含 UI 组件）未消费它——统计信息始终显示。可能是预留开关
- **触发条件**：出现"是否展示统计"的用户配置需求时
- **现状**：行为与重构前一致，不扩大范围

## 5. UI 组件直连 UseCase（去掉 DryRunManager 中转）
- **想法**：本次为减少改动面，保留 DryRunManager 作为委托层。若未来 DryRunManager 不再承载任何状态，UI 组件（OutputChannel/StatusBar/ToggleCommand）可直接注入 DryRunUseCase，删除中转类
- **触发条件**：UI 组件本身有重构需求（如统一走 VSCodeDIContainer 装配）时
- **现状**：DryRunManager 作为 API 稳定面有价值（UI 零改动），中转成本可忽略

## 6. VSCodeDIContainer 的完整激活
- **想法**：本次仅用 VSCodeDIContainer 装配 dryRunUseCase 一个依赖。容器注释预留了"VSCode 特定用例（阶段 3）"，未来 vscode 侧用例增多后可逐步迁移到容器装配模式（目前 commands 多为静态/直接 new）
- **触发条件**：vscode 侧用例数量增长、出现跨用例依赖时
- **现状**：单用例场景，容器作为装配点已足够
