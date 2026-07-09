# RPC 进程池设计

## 背景

当前 `SubProcessRunner` 每次调用 `spawn('pi --mode json ...')` 创建一次性子进程，
跑完即销毁。TDD 三循环（test → implement → test）需要频繁调用子 agent，
每次重建进程浪费启动开销（~300-800ms）。

**目标**：三个常驻子进程（test / implement / review），整个项目生命周期不复用不销毁。

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                   主会话（pi 主进程）                      │
│                                                         │
│  subagent tool                                          │
│    ↓ chain 模式                                          │
│  RpcProcessPool                                          │
│    ├── child.stdin  → JSON-L request                     │
│    └── child.stdout → JSON-L event stream                │
│                                                         │
│  销毁条件：/reload / 项目切换 / 进程 crash                │
└────────┬──────────────┬──────────────┬──────────────────┘
         │              │              │
    spawn 一次     spawn 一次     spawn 一次
   永不销毁        永不销毁        永不销毁
         ↓              ↓              ↓
┌────────────────┐ ┌──────────────┐ ┌────────────────┐
│ 🧪 test-agent  │ │ 🛠 impl-agent│ │ 🔍 review-agent│
│ pi --mode rpc  │ │ pi --mode rpc│ │ pi --mode rpc  │
│                │ │              │ │                │
│ system prompt  │ │ system prompt│ │ system prompt  │
│ = SUB-SKILL.md │ │ = SUB-SKILL  │ │ = SUB-SKILL.md │
│ ❌ 永不修改     │ │ ❌ 永不修改  │ │ ❌ 永不修改     │
└────────────────┘ └──────────────┘ └────────────────┘
```

## 通信协议：Pi RPC 模式

用 `pi --mode rpc` 替代 `pi --mode json`。

### RPC 协议结构（双向 JSON-L）

```
父进程 → stdin（请求）:
  {"id":"1","type":"request","method":"prompt","params":{"text":"写测试...","attachments":[]}}

子进程 → stdout（事件流）:
  {"id":"1","type":"event","event":"turn_start","data":{...}}
  {"id":"1","type":"event","event":"message_end","data":{...}}
  {"id":"1","type":"event","event":"turn_end","data":{...}}
  {"id":"1","type":"result","result":{"output":"...","messages":[...],"usage":{...}}}
```

### 为什么不继续用 `--mode json`

| 特性 | `--mode json` | `--mode rpc` |
|------|:------------:|:------------:|
| 通信方向 | 单向 stdout | 双向 stdin/stdout |
| 进程保持 | ❌ 跑完退出 | ✅ 保持长连接 |
| 多次 prompt | ❌ 一次一进程 | ✅ 反复下发 |
| 流式事件 | ✅ | ✅ |
| system prompt 注入 | `--append-system-prompt` | RPC 协议参数 |

### RPC 模式下 system prompt 的注入方式

初始启动时通过 `--append-system-prompt` 设置，后续不再修改：

```bash
pi --mode rpc --append-system-prompt ./sub-skill/test/SUB-SKILL.md
```

后续每次下发任务时只传 task 文本，**不修改 system prompt**，保证 LLM 缓存命中。

## 核心接口

### RpcProcessPool

```typescript
interface IRpcProcessPool {
  /**
   * 预热三个常驻进程。
   * 每个进程用各自的 SUB-SKILL.md 初始化 system prompt。
   * 在 session_start 时调用。
   */
  warmUp(): Promise<void>;

  /**
   * 向指定 agent 下发任务，返回结构化结果。
   * 复用已有进程，不创建新进程。
   */
  runTask(params: {
    agent: 'test' | 'implement' | 'review';
    task: string;
    context?: string;     // 可选上下文，嵌入 task 中
    timeoutMs?: number;
  }): Promise<AgentRunResult>;

  /**
   * Chain 模式：依次执行多个步骤，自动传递 context。
   * 内部调用 runTask，复用进程池。
   */
  runChain(steps: Array<{
    agent: 'test' | 'implement' | 'review';
    task: string;
  }>): Promise<{
    results: AgentRunResult[];
    failedIndex: number | null;   // 第一个失败的步骤索引，null 表示全部成功
  }>;

  /**
   * 销毁所有进程。/reload / 项目切换时调用。
   */
  shutdown(): Promise<void>;
}
```

### 进程状态管理

每个子进程有三个状态：

```
IDLE ──→ runTask() ──→ BUSY ──→ 任务完成 ──→ IDLE
                           │
                           ├── 超时 → 销毁重建 → IDLE
                           ├── crash → 销毁重建 → IDLE
                           └── shutdown → 终止
```

对于 TDD 三循环这种**串行使用场景**，一次只有一个进程在忙，不存在调度竞争。

## 与现有代码的对接

### 改动清单

| 文件 | 改动 |
|------|------|
| **新增** `src/adapter/pi/agents/RpcProcessPool.ts` | 进程池核心实现 |
| **重写** `src/adapter/pi/agents/SubProcessRunner.ts` | 从 spawn 一次性改为包装 RpcProcessPool |
| **调整** `src/data/repositories/ISubProcessRunner.ts` | 接口适配池模式（可选，保持兼容也行） |
| **调整** `src/adapter/pi/DIContainer.ts` | 注入 RpcProcessPool |
| **实现** `src/adapter/pi/tools/SubagentTool.ts` | 填上 chain 模式的 execute 逻辑 |
| **调整** `src/adapter/pi/extension.ts` | session_start 时 warmUp，session_shutdown 时 shutdown |

### RpcProcessPool 与其他模块的关系

```
extension.ts
  └── session_start → RpcProcessPool.warmUp()
  └── session_shutdown → RpcProcessPool.shutdown()

SubProcessRunner.ts（重写后）
  └── 内部持有 RpcProcessPool 实例
  └── run() → pool.runTask()
  └── runChain() → pool.runChain()

SubagentTool.ts（chain 模式）
  └── execute chain → SubProcessRunner.runChain()
```

## Chain 模式的执行逻辑

```typescript
async function runChain(steps, pool) {
  let prevOutput = '';
  const results = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    // 替换 {previous} 占位符
    const task = step.task.replace('{previous}', prevOutput);

    const result = await pool.runTask({
      agent: step.agent,
      task: task,
    });

    results.push(result);

    // 如果步骤失败，记录失败位置并停止
    if (result.exitCode !== 0) {
      return { results, failedIndex: i };
    }

    // 传递输出到下一步
    prevOutput = result.output;
  }

  return { results, failedIndex: null };
}
```

主 agent 拿到 `{ results, failedIndex }` 后自行决策：
- `failedIndex === null` → 全部通过
- `failedIndex === 0`（test 失败）→ 可能需求理解有问题，调整后重试
- `failedIndex === 1`（implement 失败）→ 通知 implement 修复
- `failedIndex === 2`（二次 test 失败）→ 实现有 bug，回退 implement 修复

如果整个 TDD 周期内需要多个 chain 调用，主 agent 可以：

```
// 第一轮：写测试 → 实现 → 验证
res1 = subagent({chain: [test("用户模块"), implement("用户模块"), test("用户模块")]})

// 验证不通过 → 修复 + 再验证
res2 = subagent({chain: [implement("修复登录逻辑"), test("验证登录")]})

// 全部通过 → 下一个模块
...
```

## 生命周期细节

| 事件 | 行为 |
|------|------|
| `session_start` | `pool.warmUp()` — 启动三个子进程 |
| 用户使用 subagent | `pool.runTask()` — 复用进程 |
| 进程异常退出 | 自动重建一次，重建失败则报错 |
| `/reload` | `pool.shutdown()` → 重新 warmUp |
| 项目切换（cwd 变化） | `pool.shutdown()` |
| `session_shutdown` | `pool.shutdown()` — 兜底清理 |

## 错误恢复策略

```typescript
// 进程 crash 时自动重建
async function ensureProcess(agent: AgentType): Promise<void> {
  if (this.processes[agent] && !this.processes[agent].killed) return;

  // 日志记录
  console.warn(`[RpcPool] ${agent} crashed, restarting...`);

  // 重建
  this.processes[agent] = await this.spawnProcess(agent);
}
```

## 边界情况

1. **多个工具同时调同一个 agent** — chain 模式是串行的，不存在这个问题。但如果将来有并行需求，需要加任务队列。

2. **子进程卡死** — 每个任务有 `timeoutMs`，超时后 SIGTERM → 5s 后 SIGKILL → 重建。

3. **system prompt 真的不修改吗** — 是的。task 文本和 context 都通过 prompt 参数传入，system prompt 在启动时固定。这样 LLM 的服务端缓存（如 Claude 的 prompt caching）能一直命中，省费用。

4. **进程启动时 SUB-SKILL.md 变化** — `/reload` 会销毁重建，所以只有在 `/reload` 时才会读取最新的 SUB-SKILL.md。

## 待定问题

1. **三个 agent 的名称映射** — 当前 SubSkillRepository 发现的是 `[test-writer, code-writer, reviewer]` 等，需要确定从 agent name → RPC 进程的映射规则。
2. **默认工具白名单** — 每个 agent 的 `tools` 字段在 SUB-SKILL.md 里定义，启动时是否需要额外限制？
3. **RPC 模式的 session 策略** — `--no-session` 还是保留 session？保留 session 可以让每个子 agent 有记忆，但会增加 token 消耗。

---

---

# Stop-All 强制终止

## 背景

当前 `stop-time.ts` 扩展仅拦截下一个 `tool_call`（通过 `pi.on("tool_call", ...)` 返回 `{ block: true }`），
**无法终止正在执行中的工具**。当 Pi 运行了一个卡死的任务（如文件查找卡 IO、bash 命令无限等待）时，
用户只能手动 Ctrl+C 或关窗口，体验极差。

CDD 框架引入了子进程池（`RpcProcessPool`），子进程也可能卡死或超时后未能正确清理。
需要一个可靠的「核按钮」——**强制终止整个 Pi 进程树，不留活口**。

## 核心功能（仅 1 个）

> **系统能够在用户触发时，立即强制终止整个 Pi 进程树（主进程 + 所有 RPC 子进程），不留任何存活进程。**

### 关键约束

| 维度 | 约束 |
|------|------|
| **触发方式** | 用户命令 `/stop-all`，直接输入即可触发 |
| **终止范围** | 必须覆盖：① 所有 RPC 子进程（`RpcProcessPool` 管理的） ② 主 Pi 进程本身 |
| **终止速度** | **立即 kill，不等优雅退出**。卡死场景下 SIGTERM 的 3 秒等待都嫌长 |
| **确定性** | 不管子进程当前处于 idle / busy / crashed 状态，一律杀掉 |
| **清理** | 杀掉子进程后清理临时目录（`tmpDir`）和 pending 任务队列 |
| **幂等** | 连续调两次 `/stop-all`，第二次不应报错（进程已死就跳过） |

## 功能关系（单一核心，无矩阵）

核心功能只有一个，不存在依赖/约束/复用/冲突分析。

唯一的内部分解是两步操作：
1. **杀子进程** — 遍历 `RpcProcessPool.processes`，对每个子进程直接 `SIGKILL`
2. **杀主进程** — `process.exit(1)` 终止 Pi 主进程

两步顺序执行，第 1 步成功后才能执行第 2 步。

## 验证场景

**场景：Pi 执行了一个长时间卡死的文件查找**

1. 用户输入 `find /very/large/dir -name "*.ts"`（实际是个卡死的 bash 命令）
2. 等了 60 秒，没有任何输出，用户判定任务已死
3. **用户输入 `/stop-all`**
4. Pi 的 extension 捕获命令，执行：
   - 遍历所有 RPC 子进程 → 对每个子进程 `process.kill('SIGKILL')`
   - 每个 pending 任务被 reject（`Error: 用户强制终止`）
   - 清理每个子进程的 `tmpDir` 临时目录
   - 清空 `processes` map
5. 执行 `process.exit(1)`，Pi 主进程退出
6. **结果：整个 Pi 进程树完全终止，用户回到终端 shell**

## 范围压缩线（可选）

**必须保留：** 核心 kill 能力（子进程 SIGKILL + 主进程 exit）。这是唯一功能，无延后项。

## 与现有系统的集成

| 组件 | 改动 |
|------|------|
| `src/adapter/pi/agents/RpcProcessPool.ts` | 新增 `forceKillAll(): Promise<void>` 方法 |
| `src/adapter/pi/extension.ts` | 注册 `/stop-all` 命令，注入 `forceKillAll` + 主进程 exit |
| `~/.pi/agent/extensions/stop-time.ts` | 保留不动（旧行为不破坏）。或废弃标记，由 `/stop-all` 统一接管 |

## 边界情况和防御

| 场景 | 行为 |
|------|------|
| 没有子进程时调 `/stop-all` | 跳过杀子进程步骤，直接杀主进程退出 |
| 子进程已经死亡 | `process.kill()` 对已死进程抛错 → catch 忽略，继续下一个 |
| 子进程正在执行 `warmUp` | 同样直接 SIGKILL，不等初始化完成 |
| `process.exit(1)` 被某些 handler 阻止 | 使用 `process.exit(1)` 而非 `ctx.shutdown()`，不依赖扩展事件链 |

---

**设计版本**：v2（新增 Stop-All 章节）
**日期**：2026-06-29  
**状态**：待评审
