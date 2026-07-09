# 现在必须完成 — RPC 进程池 + Chain 模式

## Phase 1.5 模块清单

| 模块 | 层级 | 职责 | 依赖的 Phase 1 模块 | 为哪些 Phase 2+ 预留了扩展口 |
|------|------|------|---------------------|----------------------------|
| RpcProcessPool | adapter/pi/agents | 三个常驻子进程管理（warmUp/runTask/runChain/shutdown） | SubSkillRepository（发现 agent 定义） | shutdown 接口已预留；并行 runTasks() 留给 Phase 2+ |
| SubProcessRunner（重写） | adapter/pi/agents | 从 spawn 一次性改为委托 RpcProcessPool，保持 ISubProcessRunner 接口不变 | RpcProcessPool | runParallel/runChain 接口已预留 |
| SubagentTool（chain） | adapter/pi/tools | 填上 chain 模式的 execute，内部调 SubProcessRunner.runChain() | SubProcessRunner | 无，chain 本阶段完整实现 |
| DIContainer | adapter/pi | 注入 RpcProcessPool | — | — |
| extension.ts | adapter/pi | session_start → warmUp，session_shutdown → shutdown | RpcProcessPool | — |

## 最小依赖链

```
extension.ts
  └── DIContainer
       ├── SubProcessRunner (重写)
       │    └── RpcProcessPool (新增) ← 核心
       │         ├── spawn('pi --mode rpc ...') × 3
       │         └── stdin/stdout JSON-L 双向通信
       └── SubagentTool
            └── SubProcessRunner.runChain()
```

## 各模块详细设计

### RpcProcessPool

**定位**：三个常驻子进程的池管理。在 adapter/pi/agents/ 下新建文件。

```
class RpcProcessPool {
  // === 进程状态 ===
  // processes: Map<AgentType, ChildProcess>
  // states: Map<AgentType, 'idle' | 'busy'>
  
  // === 核心方法 ===
  warmUp(): Promise<void>         // session_start 时调用，spawn 三个进程
  runTask(params): Promise<Result> // 向指定 agent 下发任务，复用进程
  runChain(steps): Promise<Results> // 依次 runTask，自动传 context
  shutdown(): Promise<void>        // 销毁全部进程
  
  // === 进程发现 ===
  // agent name 直接从 SubSkillRepository.findByName() 获取
  // 不硬编码映射关系，SubProcessRunner 传入 agent name
}
```

### SubProcessRunner 重写

**接口不变**，内部实现替换：

```typescript
// 改前：每次 spawn('pi --mode json ...') → 等退出
// 改后：委托 pool.runTask() → 复用进程

class SubProcessRunner implements ISubProcessRunner {
  constructor(private pool: RpcProcessPool) {}
  
  async run(params): Promise<AgentRunResult> {
    return this.pool.runTask({
      agent: params.agentName,  // 直接传 "tdd-test-writer" 等
      task: params.task,
      context: params.context,
      timeoutMs: params.timeoutMs,
    });
  }
  
  async runChain(steps): Promise<ChainResult> {
    return this.pool.runChain(steps);
  }
}
```

### SubagentTool chain 模式

```typescript
// chain 参数的 execute 实现
if (params.chain) {
  const result = await this.subProcessRunner.runChain(
    params.chain.map(step => ({
      agent: step.agent,
      task: step.task,
    }))
  );
  return { content: [格式化报告], details: { result } };
}
```

## 扩展预留声明

| 模块 | 预留的扩展点 | 对应的 Phase 2+ 模块 |
|------|-------------|---------------------|
| RpcProcessPool | `runTasks()`（并行模式） | Phase 2+ 并行调度 |
| SubProcessRunner | `runParallel()` 接口签名 | Phase 2+ |
| SubagentTool | `tasks[]` 参数解析分支 | Phase 2+ 并行模式 |

## 风险和边界

1. **RPC 模式下 `--no-session` 的取舍**
   - 用户确认：**保留 session**，子 agent 需要记忆才能协作
   - 代价：每个子进程 token 消耗随对话累积而增长
   - 缓解：子 agent 的对话累积在各自的 session 中，不影响主会话

2. **进程 crash 恢复**
   - 风险：子进程异常退出
   - 缓解：runTask 内部检测到 killed 后自动重建，重试一次

3. **SKILL.md 是否需要更新**
   - execute/SKILL.md 当前用 `spawn_agent` 描述流程
   - 推荐：在 Phase 1.5 完成后更新它，将 `spawn_agent` 改为 `subagent({chain: [...]})`
   - 但这不是扩展本身的改动，是使用文档层面的更新

