# 后续扩展 — 分层接口设计

## 数据层（Data Layer）

### 实体扩展（Phase 2+）

#### AgentDefinition 扩展字段
- **新增字段**：无。Phase 1 已覆盖全部字段
- **新增关系**：可与 IFileRepository 关联，用于缓存 agent 列表

#### AgentRunResult 扩展字段
- **新增字段**：`messages?: Message[]` — 完整的 JSON Lines 消息列表（用于 TUI 展开视图）
- **新增字段**：`stopReason?: string` — LLM stop reason（用于错误诊断）
- **新增字段**：`errorMessage?: string` — LLM 错误消息

### 仓库接口扩展（Phase 2+）

#### IAgentRepository 扩展

实现 Phase 1 预留的接口：
- `reload(): Promise<void>` — 强制刷新缓存（目前实时扫描，未来可加内存缓存减少 I/O）

#### ISubProcessRunner 扩展

实现 Phase 1 预留的接口：
- `runParallel(params: SubProcessParallelParams): Promise<AgentRunResult[]>`
  - 并发控制：最大 8 任务，4 同时
  - AbortSignal 支持
  - 实时逐任务更新回调
- `runChain(params: SubProcessChainParams): Promise<AgentRunResult[]>`
  - `{previous}` 占位符替换
  - 任一环节失败则停止

---

## 应用层（Application Layer）

### 用例扩展（Phase 2+）

#### SpawnParallelAgentsUseCase
- **职责**：并发运行多个 agent，实时汇总各任务状态
- **前置条件**：任务数 ≤ 8
- **后置条件**：返回所有 AgentRunResult[]
- **依赖的预留接口**：
  - `ISubProcessRunner.runParallel()`（Phase 2+）

#### SpawnChainAgentsUseCase
- **职责**：链式运行 agent，上一步输出注入下一步
- **前置条件**：至少 2 个 agent 步骤
- **后置条件**：任一失败则停止并报告
- **依赖的预留接口**：
  - `ISubProcessRunner.runChain()`（Phase 2+）

---

## 适配层（Adapter Layer）

### 适配器扩展（Phase 2+）

#### SubagentTool — 并行模式
- **入口**：`src/adapter/pi/tools/SubagentTool.ts`
  - pi 注册名 `subagent`，`tasks` 参数分支
  - 支持 `tasks: [{agent, task, cwd?}]` 数组
- **调用的用例**：`SpawnParallelAgentsUseCase`
- **技术选型**：`mapWithConcurrencyLimit` 模式（复用官方实现）

#### SubagentTool — 链式模式
- **入口**：同上，`chain` 参数分支
  - 支持 `chain: [{agent, task, cwd?}]` 数组
  - `{previous}` 占位符自动替换
- **调用的用例**：`SpawnChainAgentsUseCase`
- **技术选型**：顺序 for 循环 + 上下文拼接

#### TUI 渲染 (renderCall / renderResult)
- **入口**：`SubagentTool.ts` / `SpawnAgentTool.ts`
- **renderCall**：显示 agent 名 + 任务摘要 + 模式标签（`[single]` / `[parallel:3]` / `[chain:2]`）
- **renderResult**：折叠视图（状态图标 + 最后 5~10 项 + 统计）/ 展开视图（完整工具调用 + Markdown 输出）
- **技术选型**：`@earendil-works/pi-tui` 的 `Container`、`Markdown`、`Spacer`、`Text`

#### 自动部署脚本
- **入口**：`scripts/deploy-pi-extension.js`
  - `npm run compile:pi` 后自动运行
  - 将 `dist/pi/` 复制到 `~/.pi/agent/extensions/ccd-framework/`
- **前置条件**：dist/pi/ 构建产物存在
- **后置条件**：pi 下次启动（或 `/reload`）后加载新扩展

---

## 数据流变化

### Phase 1 数据流
```
[Pi Extension (spawn_agent tool)]
  → SpawnAgentUseCase
    → IAgentRepository.findByName()     [实时扫描文件系统]
    → ISubProcessRunner.run()            [spawn pi --mode json]
  → AgentRunResult 返回给 LLM
```

### Phase 2+ 新增数据流
```
[Pi Extension (subagent tool — parallel)]
  → SpawnParallelAgentsUseCase
    → IAgentRepository.findByName()      [可能使用缓存]
    → ISubProcessRunner.runParallel()    [4 并发限制]
  → AgentRunResult[] 返回给 LLM + TUI 实时更新

[Pi Extension (subagent tool — chain)]
  → SpawnChainAgentsUseCase
    → IAgentRepository.findByName()
    → ISubProcessRunner.runChain()       [顺序 + {previous}]
  → 任一失败停止 + 错误诊断

[自动部署]
  npm run compile:pi
    → vite build (pi 入口)
    → deploy script → ~/.pi/agent/extensions/ccd-framework/
```
