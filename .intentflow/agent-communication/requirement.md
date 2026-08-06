# 需求文档：Agent 通信抽象（agent-communication）

## 项目意图
把 spawn_agent（单向任务派发）抽象为"上下文间通信"模式：主 agent 与子 agent（另一个正在运行的 pi 上下文）通过一组通信原语进行双向、多轮对话；子 agent 运行中可暂停并向主 agent 提问、等待回答后继续。

## 功能清单
1. **agent_chat 通信工具**：单工具形态——发送消息并等待下一轮回应（send+await 合成，自动分派通道：等待回复时走 response 通道，否则新消息 prompt 通道）。request/await/reply/close 已收敛合并（等待是动作的阻塞语义而非独立工具；不发消息即会话挂起，无需显式关闭）
2. **agent_request 合成原语**：send + await 一步到位，替代原 spawn_agent 的日常"派发任务拿结果"场景
3. **ask_parent 子侧提问通道**：子 agent 运行中可调用 `ask_parent` 工具向主 agent 提问并阻塞等待回答
4. **运行期会话**：同一 agent 的多次通信共享对话历史（进程池存活期间）
5. **废弃 spawn_agent**：移除工具及其关联的 UseCase / Runner / 仪表盘集成，统一到通信语义

## 核心功能

### 核心功能1：双向通信原语工具集
- **能力**：系统能够 [向指定 agent 会话] [发送消息 / 阻塞等待下一条消息 / 回复提问 / 关闭会话]，消息往返不丢失、不乱序，支持超时中断
- **业务价值**：主 agent 与子 agent 的关系从"一次性派工"升级为"可协作的对话伙伴"，可随时追问、澄清、中途纠偏

### 核心功能2：ask_parent 提问-回答通道
- **能力**：系统能够 [在子 agent 运行中] [通过 ask_parent 工具向主 agent 提问]，主 agent 以工具返回形式收到提问并用 reply 原语代答，子 agent 收到回答后继续执行
- **业务价值**：子 agent 遇到歧义不再盲猜或直接失败，可向主 agent 澄清后继续，显著提升长任务成功率

### 核心功能3：运行期会话
- **能力**：系统能够 [对同一 agent] [维持对话历史]，多次 send/await 之间上下文延续，close 后重新通信开启新会话
- **业务价值**：多轮协作不需要每次重述全部背景，对话像与真人协作一样自然

## 业务规则

### 消息类型与 await 返回语义
- **场景**：主 agent 调用 `agent_await` 等待期间，子 agent 侧可能发生两种事件
- **行为**：`agent_await` 返回结构化结果，区分两类：
  - `{ kind: 'question', question, askCount }`：子 agent 提问，等待主 agent 回复
  - `{ kind: 'result', result }`：子 agent 本轮任务完成，携带最终输出（复用 AgentRunResult 结构）
- **异常处理**：超时未收到任何消息 → 返回 `{ kind: 'timeout' }` 并保持会话可用；子进程崩溃 → 返回 `{ kind: 'error' }` 并触发进程池自动重建

### 提问-回答循环（两阶段消息驱动，防死锁）
- **场景**：子 agent 调用 ask_parent 提问
- **行为**：
  1. 子进程发出提问请求（extension_ui_request 协议），子 agent 侧阻塞等待
  2. 主进程拦截并缓存提问；正在 await 的 `agent_await` 立即返回 `{ kind: 'question' }`，提问进入主 agent 上下文
  3. 主 agent 生成回答后调用 `agent_reply`，主进程注入子进程 stdin，子 agent 恢复执行
  4. 循环直到子 agent 完成或超时
- **异常处理**：主 agent 未在 await 时提问到达 → 缓存为待处理消息，下次 await 时优先返回；主 agent 始终不回 → 子侧等待超时（复用 timeoutMs）后子 agent 按超时处理

### ask_parent 提问上限
- **场景**：子 agent 反复提问形成死循环
- **行为**：单次任务内 ask_parent 有上限（默认 3 次），超过后 ask_parent 直接报错，子 agent 须自行决策
- **异常处理**：达到上限的提问不进入主 agent 上下文，子进程继续执行

### 超时
- **场景**：await / request 阻塞等待超过 timeoutMs
- **行为**：中断等待并返回 timeout 结果；子进程按现有超时策略处理（SIGTERM → 5s → SIGKILL）
- **异常处理**：超时后会话标记为可复用（idle），不泄漏挂起任务

### agent_close 语义
- **场景**：主 agent 调用 `agent_close(agent)`
- **行为**：仅标记会话结束（对话历史归档标记），进程保留在池中继续常驻 idle；下次对该 agent 通信开启新会话上下文
- **异常处理**：对不存在会话的 agent 调用 close → 幂等，无操作

### 消息节流与可视化
- **场景**：子 agent 流式输出中间消息
- **行为**：复用现有防刷逻辑（同段文本累积超阈值才推送）；中间事件实时推送 TUI / 仪表盘轨迹
- **异常处理**：渲染失败不影响通信主流程

## 预设测试

### 前置条件
- pi 开发环境（`pi -e ./dist/extension.js` 或等价的扩展加载方式）
- 存在至少一个 sub-skill agent 定义（如 `skills/<skill>/sub-skill/<agent>/SUB-SKILL.md`）
- 扩展已注册全部通信原语工具

### 测试步骤

1. **[agent_request 派发任务]**：主 agent 调用 `agent_request(agent, task)` 派发一个需要输出结果的任务
   **预期结果**：返回 `{ kind: 'result', result }`，包含子 agent 最终输出、usage、耗时；TUI 展示与旧 spawn_agent 等价的完成视图

2. **[ask_parent 双向提问]**：给子 agent 的任务中明确要求"遇到 X 情况先问主 agent"，X 在任务中故意留歧义
   **预期结果**：`agent_await` 先返回 `{ kind: 'question', question }` 且提问内容正确进入主 agent 上下文；主 agent 调用 `agent_reply` 后子 agent 收到回答并继续，最终返回 `{ kind: 'result' }`

3. **[多轮对话历史延续]**：依次 `agent_send(agent, msg1)` + `await` → `agent_send(agent, msg2)` + `await`，msg2 中引用 msg1 的内容（如"刚才提到的那个文件"）
   **预期结果**：第二次通信中子 agent 理解 msg1 的引用，说明同一会话历史已延续

4. **[agent_close 开新会话]**：多轮对话后调用 `agent_close(agent)`，再 `agent_send` 一条引用旧对话内容的消息
   **预期结果**：子 agent 不记得旧对话内容，新会话上下文生效

5. **[废弃验证]**：检查工具列表
   **预期结果**：`spawn_agent` 不再出现在可用工具中，原使用场景由 `agent_request` 覆盖

### 异常场景

- **[子 agent 提问后主 agent 不回]**：任务中触发提问但不调用 reply → await 超时返回 timeout，子进程被回收，会话可复用
- **[子进程崩溃]**：手动 kill 子进程 → 下次通信自动重建进程，报错信息可读
- **[agent 不存在]**：`agent_request('nonexistent', ...)` → 报错"Agent not found"，不创建进程
- **[提问超上限]**：任务要求子 agent 连续提问 4 次 → 第 4 次 ask_parent 报错，前 3 次正常流转

## 边界收束

**此时必做**：
- 四原语（send / await / reply / close）+ request 合成原语
- ask_parent 子侧通道（子进程 `--extension` 加载轻量扩展）
- 运行期会话（复用 RPC 子进程 session，不带 `--no-session`）
- 移除 spawn_agent（工具 / SpawnAgentUseCase / ISubProcessRunner.run / runChain 相关入口统一收敛）
- TUI 渲染与仪表盘轨迹适配通信语义

**此时不做**：
- 持久化会话跨主 session 重启续接 — RPC session 落盘已有基础，但会话寻址/恢复策略未定义；出现"跨重启续接协作"真实场景再做
- 并发多通道（同一 agent 并行多个独立会话）— 进程池单进程单会话模型未扩展；出现并行协作需求再做
- 子 agent 消息主动唤醒主 agent（异步推送触发新回合）— 依赖 pi sendMessage triggerTurn，涉及主循环干预，复杂度高；主 agent 被动接收消息场景出现再做
- 群组/广播通信（A2A 风格多 agent 网状）— 超出"两两通信"本轮范围；出现多 agent 协作编排需求再做

## 实现取向

协作者开始设计实现前需要知道的技术取向声明。

- **两阶段消息驱动**：主 agent 从不在工具执行中"等待的同时思考"。await 把子 agent 提问以工具返回形式带进主 agent 上下文，主 agent 用 reply 原语代答——天然规避父子互等死锁（参考 pi-subagents issue #335 教训）
- **子侧通道走官方协议**：ask_parent 通过子进程 `--extension` 加载 IntentFlow 轻量扩展（子进程模式只注册 ask_parent，不跑完整扩展逻辑），提问用 pi 官方 extension_ui_request/response 子协议，不发明私有消息格式
- **主进程侧改造点**：RpcProcessPool 增加 extension_ui_request 拦截与等待队列（提问缓存 + await 消费）；pending 任务模型扩展为"可多次交付消息"
- **会话复用**：沿用 RPC 子进程常驻 + session 持久化（spawnProcess 不传 `--no-session`），"新会话"通过会话归档标记实现，不销毁进程
- **合成原语**：agent_request 内部 = send + await 循环（含提问-回答子循环），是四原语的组合而非独立实现
- **废弃收敛**：SpawnAgentUseCase 职责并入通信原语用例；AgentRunTracker 从"单次运行追踪"演进为"会话轨迹"
