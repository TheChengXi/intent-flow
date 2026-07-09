# 后续扩展 — 架构设计

## Phase 2+ 模块清单

| 模块 | 层级 | 职责 | 依赖 Phase 1 的哪个模块 | 依赖哪个扩展接口 |
|------|------|------|----------------------|----------------|
| 并行 agent 调度 | application/useCases | 并发执行多个 agent，限制最大并发数 | RpcProcessPool | runTasks() 预留接口 |
| Agent 缓存层 | application/useCases | 减少重复文件扫描，缓存 AgentDefinition | SubSkillRepository | reload() 预留接口 |
| MCP 集成 | adapter/mcp | 将 spawn_agent / subagent 暴露为 MCP 工具 | SpawnAgentTool | 无，直接复用现有逻辑 |
| TUI 渲染增强 | adapter/pi/tools | SubagentTool 的 chain/并行渲染 | SubagentTool | renderCall/renderResult 预留 |

## 接入条件

| Phase 2+ 模块 | Phase 1.5 必须提供 | 接入方式 |
|--------------|-----------------|---------|
| 并行 agent 调度 | RpcProcessPool 的进程池稳定运行 | 新增 RunTasksUseCase，内部调 pool.runTasks() |
| Agent 缓存层 | SubSkillRepository 接口稳定 | 在 SubSkillRepository 内加内存缓存 + reload() |
| MCP 集成 | SubProcessRunner 接口稳定 | 在 MCP 层注册新工具 |
| TUI 渲染增强 | SubagentTool chain 返回结构化结果 | 实现 renderCall/renderResult |

## 架构影响评估

如果全部实现：

```
adapter/pi/
├── extension.ts
├── DIContainer.ts
├── agents/
│   ├── SubSkillRepository.ts     ← 不变
│   ├── SubProcessRunner.ts       ← 重写（委托 RpcProcessPool）
│   └── RpcProcessPool.ts         ← 新增（核心）
├── tools/
│   ├── SpawnAgentTool.ts         ← 不变
│   └── SubagentTool.ts           ← 扩展 chain 模式
├── useCases/                     ← Phase 2+ 可能新增
│   └── RunTasksUseCase.ts        ← 并行调度
└── README.md
```

**层间依赖方向不变**，没有破坏性重构。

