# 设计文档：Agent 通信抽象（agent-communication）

> 对应需求：`.intentflow/agent-communication/requirement.md`
> 项目分层：IntentFlow 三层（adapter → application → data），本次为已有项目增量设计，顺应原有结构。

## 设计要点（先读这段）

**对需求文档的一处修正**：`agent_request` 内部**不含**提问-回答子循环。原因：主 agent 代答必须发生在主 agent 的回合里——工具执行期间主 agent 模型不运行，工具内部无法代答。正确语义：

- `agent_request` = send + 首次 await（返回 `question` 或 `result`）
- 提问-回答循环由主 agent 用 **request/await + reply 组合**完成：`request → question → reply → await → ... → result`

这是两阶段消息驱动的必然推论，其余需求不变。

## 模块清单

### 新增模块

- **[IAgentMessagingService]**：[application/services] — 职责：定义 agent 消息交换原语接口 `send / await / reply / close` 与消息类型（`AgentAwaitResult`：question | result | timeout | error）；承接 `AgentRunResult / AgentUsage` 实体类型的 application 透出（从 ISubProcessRunner 迁移）— 依赖：data 实体类型（type-only）

- **[AgentRequestUseCase]**：[application/useCases] — 职责：`agent_request` 合成原语——send + 首次 await，组装任务消息（task + context）、默认超时、agent 存在性校验、结果归一化（question/result/timeout/error 统一出口）— 依赖：IAgentMessagingService、IAgentRepository

- **[AgentMessagingService]**：[adapter/pi/runtime] — 职责：IAgentMessagingService 的 pi 实现——组合 RpcProcessPool 的进程通道能力：send 发 prompt 命令、await 注册等待者、reply 写回 extension_ui_response、close 发 new_session 命令 — 依赖：RpcProcessPool、IAgentRepository

- **[ChildExtension]**：[adapter/pi/child]（新目录）— 职责：子进程专用轻量扩展入口——只注册 `ask_parent` 工具（execute 内调 `ctx.ui.input` 发 extension_ui_request 阻塞等待回答），**不注册**任何其他工具/命令/TUI；ask_parent 内置每任务提问计数（上限 3，超限直接报错）— 依赖：pi ExtensionAPI（外部）

- **[AgentCommTools]**：[adapter/pi/tools] — 职责：注册 5 个通信工具（`agent_send / agent_await / agent_reply / agent_close / agent_request`）+ TUI 渲染（renderCall/renderResult，渲染辅助函数从 SpawnAgentTool 迁入）+ tracker 推送（运行轨迹、提问/回答日志）— 依赖：IAgentMessagingService、AgentRequestUseCase、AgentRunTracker

### 修改模块

- **[RpcProcessPool]**：[adapter/pi/runtime] — 职责扩展：进程级通道升级
  - spawnProcess 增加 `--extension <ChildExtension 路径>`（子进程加载轻量扩展）
  - stdout 解析新增 `extension_ui_request` → 按 agent 缓存为待处理提问 → 唤醒/入队等待者
  - stdin 命令新增 `extension_ui_response`（reply）、`new_session`（close 重置会话）
  - `runTask / runChain` 删除，替换为消息级方法（sendMessage / awaitMessage / replyMessage / resetSession）
  - `agent_end` 结果解析保留（await 的 result 出口）
  - 依赖：不变（无上层依赖）

- **[AgentRunTracker]**：[adapter/pi/tui] — 职责扩展：LogLevel 增加 `question` / `reply` 级别（提问/回答在轨迹中可见）；运行记录结构保持，会话多轮消息按序追加日志 — 依赖：不变

- **[DIContainer]**：[adapter/pi] — 组装变更：移除 spawnAgentUseCase / spawnAgentTool / subProcessRunner，新增 agentMessagingService / agentRequestUseCase / agentCommTools

- **[extension.ts]**：[adapter/pi] — 注册变更：`container.agentCommTools.register(pi)` 取代 spawnAgentTool 注册

- **[index.ts / tools/index.ts]**：[adapter/pi] — 导出变更：移除 SpawnAgentTool / SubProcessRunner 导出，新增 AgentCommTools / AgentMessagingService / ChildExtension

### 删除模块

- **[SpawnAgentTool.ts]**：[adapter/pi/tools] — 废弃，被 AgentCommTools 取代
- **[SpawnAgentUseCase.ts]**：[application/useCases] — 废弃，被 AgentRequestUseCase 取代
- **[ISubProcessRunner.ts]**：[application/services] — 废弃，被 IAgentMessagingService 取代（run 一次性语义被 request 合成取代；runChain 无调用方）
- **[SubProcessRunner.ts]**：[adapter/pi/runtime] — 废弃，被 AgentMessagingService 取代（spawnOnce 一次性模式无法承载双向通道，通信只走 RPC 进程池）

## 依赖链

```
extension.ts (adapter/pi)
  └─ AgentCommTools (adapter/pi/tools)          ← 5 工具注册 + TUI 渲染 + tracker 推送
       ├─ AgentRequestUseCase (application/useCases)
       │    └─ IAgentMessagingService (application/services) ← 接口
       │         └─ AgentMessagingService (adapter/pi/runtime) ← 实现
       │              └─ RpcProcessPool (adapter/pi/runtime)
       │                   ├─ IAgentRepository (application) → AgentRepositoryImpl (data)
       │                   └─ ChildExtension (adapter/pi/child) ← spawn 时 --extension 注入子进程
       └─ AgentRunTracker (adapter/pi/tui)
```

关键约束：工具（adapter）只依赖 application 接口与用例，不依赖 runtime 具体实现；AgentMessagingService 是唯一依赖 RpcProcessPool 的上层。

## 关键接口设计

### IAgentMessagingService（application/services/IAgentMessagingService.ts）

```typescript
export type AgentAwaitKind = 'question' | 'result' | 'timeout' | 'error';

export interface AgentQuestion {
  kind: 'question';
  question: string;
  requestId: string;   // extension_ui_request 的 id，reply 时回填
  askCount: number;    // 本任务内累计提问次数（供主 agent 参考）
}
export interface AgentResult { kind: 'result'; result: AgentRunResult; }
export interface AgentTimeout { kind: 'timeout'; }
export interface AgentError { kind: 'error'; message: string; }

export type AgentAwaitResult = AgentQuestion | AgentResult | AgentTimeout | AgentError;

export interface IAgentMessagingService {
  /** 非阻塞发送消息；进程不存在则按 agent 定义创建（含 --extension） */
  send(agent: string, message: string, options?: { skipExts?: string[] }): Promise<void>;
  /** 阻塞等待下一条消息（question/result/timeout/error）；timeoutMs 默认 600000 */
  await(agent: string, timeoutMs?: number): Promise<AgentAwaitResult>;
  /** 回答子 agent 的提问（按 requestId 写回 extension_ui_response） */
  reply(agent: string, answer: string): Promise<void>;
  /** 关闭会话：向子进程发 new_session，进程保留常驻，下次通信为新会话 */
  close(agent: string): Promise<void>;
}

// re-export（从 ISubProcessRunner 迁移，保持 data 实体透出）
export type { AgentRunResult } from '../../data/entities/AgentRunResult';
export type { AgentUsage } from '../../data/entities/AgentUsage';
```

### AgentRequestUseCase（application/useCases/AgentRequestUseCase.ts）

```typescript
export interface AgentRequestInput {
  agent: string;
  task: string;
  context?: string;          // 追加到消息末尾（"## 上下文"）
  model?: string;            // 进程级，仅首次 spawn 生效
  timeoutMs?: number;        // 默认 600000
  skipExts?: string[];       // 进程级，仅首次 spawn 生效
}
// execute = send(agent, task+context) + await(agent, timeoutMs)，返回 AgentAwaitResult
```

### RpcProcessPool 消息级方法

```typescript
sendMessage(agent, message): Promise<void>            // 原 runTask 的 prompt 发送
awaitMessage(agent, timeoutMs): Promise<AgentAwaitResult>  // 等待者注册（单等待者槽位，并发排队）
replyMessage(agent, requestId, answer): Promise<void> // 写 extension_ui_response
resetSession(agent): Promise<void>                    // 写 new_session 命令
// 提问缓存：Map<agent, AgentQuestion[]>（无人 await 时入队，await 时优先取队列）
// agent_end → 解析 AgentRunResult → resolve 等待者（result）
// extension_ui_request → 缓存提问 → resolve 等待者（question）/ 入队
```

### ChildExtension（adapter/pi/child/ChildExtension.ts）

```typescript
// 子进程轻量入口：只注册 ask_parent
pi.registerTool({
  name: 'ask_parent',
  description: '向主 agent 提问并等待回答。仅在信息缺失必须澄清时使用，单任务最多 3 次。',
  parameters: Type.Object({ question: Type.String() }),
  execute: async (toolCallId, params, signal, onUpdate, ctx) => {
    // ctx.ui.input → RPC 模式自动发 extension_ui_request 并阻塞等待 extension_ui_response
    // 计数器：每次收到新 prompt（message_start 事件）重置，超过 3 次直接报错
  },
});
```

## 本次设计决策

1. **接口上移 application，延续 ISubProcessRunner 模式**：通信能力本质是平台进程协议（pi RPC + extension_ui_request），实现留在 adapter/runtime；但接口定义在 application/services，工具只依赖接口——与既有模式完全一致，可测试、可替换。

2. **request 不含提问子循环（对需求的修正）**：主 agent 代答只能在主 agent 回合发生，工具执行中无法代答。`agent_request` = send + 首次 await；提问-回答循环 = request/await + reply 的组合。文档与 promptGuidelines 中引导主 agent 使用该循环。

3. **spawn 一次性模式整体删除**：`--mode json` 用完即弃，子 agent 提问无送达路径，无法承载双向通信。通信只走 RPC 进程池（无池直接报错，不降级）。连带删除无调用方的 runChain。

4. **ask_parent 复用官方 extension_ui_request 子协议，不发明私有格式**：子进程 `ctx.ui.input` → 协议层自动发请求并阻塞；主进程拦截后**不弹窗**（回复方是主 agent 而非用户），缓存为提问，reply 时写回 `extension_ui_response`。

5. **提问上限双层防护**：子侧强制——ask_parent 计数器（每任务 3 次，超限报错，防子 agent 死循环）；主侧参考——await 返回 `askCount` 供主 agent 判断（防主 agent 无脑代答）。

6. **close = new_session 命令**：RPC 协议原生支持会话重置，进程保留常驻 idle——精确实现"仅标记会话结束，进程保留"；下次通信天然是新会话，无需销毁进程。

7. **子进程轻量入口独立成目录（adapter/pi/child）**：不污染主扩展入口；子进程只注册 ask_parent，不加载 guard/tracker/其他工具。spawn 时 `--extension` 传解析后的绝对路径（基于当前脚本路径解析，兼容编译产物）。

8. **模型/白名单参数降级为进程级**：原 runTask 每任务传 model/skipExts（变更即重启进程）；新模型下 model/skipExts 仅首次 spawn 生效（进程生命周期内不变），request 工具保留参数兼容原 spawn_agent 用法。

9. **tracker 最小适配**：仅扩展 LogLevel（question/reply），运行记录结构不变——通信多轮在现有"运行轨迹"上按序追加，不重构仪表盘。

## 改动点清单

**新增文件（6）**：
- `src/application/services/IAgentMessagingService.ts`
- `src/application/useCases/AgentRequestUseCase.ts`
- `src/adapter/pi/runtime/AgentMessagingService.ts`
- `src/adapter/pi/child/ChildExtension.ts`
- `src/adapter/pi/tools/AgentCommTools.ts`
- （渲染辅助函数自 SpawnAgentTool 迁入 AgentCommTools 内部，不单独建文件）

**修改文件（6）**：
- `src/adapter/pi/runtime/RpcProcessPool.ts` — 消息级通道升级（最大改动点）
- `src/adapter/pi/DIContainer.ts` — 组装变更
- `src/adapter/pi/extension.ts` — 注册变更
- `src/adapter/pi/index.ts` — 导出变更
- `src/adapter/pi/tools/index.ts` — 导出变更
- `src/adapter/pi/tui/AgentRunTracker.ts` — LogLevel 扩展

**删除文件（4）**：
- `src/adapter/pi/tools/SpawnAgentTool.ts`
- `src/adapter/pi/runtime/SubProcessRunner.ts`
- `src/application/useCases/SpawnAgentUseCase.ts`
- `src/application/services/ISubProcessRunner.ts`

**受影响但不需要改的**：`ClearSubagentCacheCommand`（独立）、`ListAgentsTool` / `DiscoverAgentsUseCase`（保留）、`ToolAccessGuard`（保留，子进程 skipExts 注入逻辑保留）。

**跨层依赖核验**：新增/修改后无跨层依赖——application 不 import adapter；adapter 经 application 接口/用例访问；RpcProcessPool 保持零上层依赖。

---

## 实现偏离记录（与设计文档的差异，实现阶段确认后更新）

1. **新增 MessageRouter.ts（设计未列）**：消息调度状态机（任务队列/等待者配对/提问队列/事件解析）从 RpcProcessPool 抽出为独立纯逻辑模块——进程 I/O 与调度逻辑分离，可单测（23 个用例覆盖，含并发场景）。
2. **ChildExtension 不独立打包**：vite lib 模式不支持多入口 → 同一 bundle + `IFLOW_CHILD` 环境变量分支（extension.ts 检测后只注册 ask_parent），spawn 时 `--extension <__filename>` 传当前 bundle 自身路径。零构建改动。
3. **并发串行队列化（bug 修复）**：实现中发现并修复"同一 agent 并发派发任务 → pending 覆盖 → 消息丢失悬挂"缺陷（用户并行 test-writer 触发）。RpcProcessPool 的 pending Map 改为 per-agent FIFO 任务队列 + 等待者配对（当前任务优先续接提问，队首任务次之）。同一 agent 的消息按序执行、不丢失，上下文一致。
4. **reply 的 requestId 内部匹配**：接口保持 `reply(agent, answer)`，requestId 由 pool 内部取队首未回复提问（getPendingRequestId）——主 agent 无需感知协议细节。
5. **isError 移除**：pi 的 AgentToolResult 无 isError 字段（错误经抛异常表示）；工具错误改为返回错误文本（不中断主循环）。
6. **onEvent 可视化载体**：send options 增加 `onEvent`（子进程中间事件回调），工具层移植旧 spawn_agent 的防刷推送逻辑 → tracker 实时日志。
7. **工具集收敛（关账后修正）**：删除 agent_send，收敛为 4 工具（request/await/reply/close）。依据：业界“fewer tools outperform more tools”（Anthropic 官方工程博客）——子 agent 串行模型下 send 的“发消息不等”语义被 request（send+await）完全覆盖，多一个工具即多一次模型误选面。send 保留为 IAgentMessagingService 内部通道（仅供 AgentRequestUseCase），不注册为工具。
8. **单工具收敛（终版）**：request/reply 本质是同一动作（发消息+等待），仅通道不同；close 无存在必要（不发消息即会话挂起为静态文本，进程生命周期由进程池管理）。最终收敛为**单工具 agent_chat**：发消息并等待下一轮，自动分派通道——MessageRouter 新增 awaitingReply 状态（提问投递时置位、回复/agent_end 清除）作为分派依据，等待回复时消息走 extension_ui_response 通道，否则走 prompt 通道。工具数 5→3→1，接口仅剩 send/await（内部通道）。
