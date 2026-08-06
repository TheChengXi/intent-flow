# agent-communication 关账报告

## 1. 项目概览
把 spawn_agent（单向任务派发）抽象为"上下文间通信"模式：主 agent 与子 agent（另一个 pi 上下文）通过 5 个通信原语（agent_send / agent_await / agent_reply / agent_close / agent_request）双向多轮对话；子 agent 运行中可经 ask_parent 向主 agent 提问并阻塞等待代答；同一 agent 的并发消息按 FIFO 串行化（不丢失、上下文一致）；会话在进程池存活期间保持对话历史。

## 2. 计划 vs 实际

| 计划功能 | 状态 | 说明 |
|---|---|---|
| 通信原语工具集（send/await/reply/close + request 合成） | ✅ 完成 | 收敛为 4 工具（request/await/reply/close），agent_send 关账后移除（见关键决策 #8） |
| ask_parent 子侧提问通道 | ✅ 完成 | 同 bundle + IFLOW_CHILD 分支（见关键决策 #3） |
| 运行期会话（对话历史延续） | 🔸 部分 | 协议层支持（RPC session 不传 --no-session）；真实进程行为待 smoke 验证 |
| 废弃 spawn_agent | ✅ 完成 | 4 文件删除，无残留引用 |
| TUI 渲染 / tracker 轨迹适配 | ✅ 完成 | LogLevel 加 question/reply + 专属图标 |
| 并发派发消息不丢失（bug 修复，需求外新增） | 🔸 部分 | 状态机 25 条测试锁定；真实进程并发 smoke 待验证 |

## 3. 关键决策

1. **request 不含提问-回答子循环**（对需求文档的修正）：工具执行期间主 agent 模型不运行、无法代答。`agent_request` = send + 首次 await；提问循环由主 agent 用 request/await + reply 组合完成。
2. **并发串行队列化**（实现中发现并修复的 bug）：同一 agent 并发派发时，旧 pending Map 按 agent 名索引互相覆盖 → 消息丢失悬挂（并行 test-writer 真实触发）。改为 per-agent FIFO 任务队列 + 等待者配对（当前任务优先续接提问、队首任务次之），消息不丢失、上下文一致。
3. **ChildExtension 不独立打包**：vite lib 模式不支持多入口 → 同一 bundle + `IFLOW_CHILD=1` 环境变量分支（extension.ts 检测后只注册 ask_parent），spawn 时 `--extension <__filename>` 传当前 bundle 自身路径，零构建改动。
4. **MessageRouter 独立成模块**（设计未列）：消息调度状态机（任务队列/等待者配对/提问队列/事件解析）从 RpcProcessPool 抽出——进程 I/O 与调度逻辑分离，纯逻辑可单测。
5. **reply 的 requestId 内部匹配**：接口保持 `reply(agent, answer)`，requestId 由 pool 取队首未回复提问——主 agent 无需感知协议细节。
6. **isError 字段移除**：pi 的 AgentToolResult 无 isError（错误经抛异常表示）；工具错误改为返回错误文本，不中断主循环。
7. **onEvent 可视化载体**：send options 增加 onEvent（子进程中间事件回调），工具层移植旧 spawn_agent 的防刷推送 → tracker 实时日志。
8. **工具集收敛（关账后修正）**：删除 agent_send，收敛为 4 工具。依据：业界“fewer tools outperform more tools”（Anthropic 官方工程博客）——串行模型下 send 的 fire-and-forget 语义被 request（send+await）完全覆盖，多一个工具即多一次模型误选面。send 保留为内部通道（IAgentMessagingService.send，仅供 AgentRequestUseCase）。

## 4. 经验记录

**有效做法**
- 调度状态机（纯逻辑）与进程 I/O 分离 → 25 条单测覆盖并发/提问/超时全场景，无需真实进程
- 先测试锁定行为再实现（test-writer 产出规格 → 实现对齐 → 全绿）
- 接口签名先行：test-writer 只给签名+行为规格，产出与实现零耦合
- 崩溃路径（进程 exit → 全部等待者 resolve error + resetChannel）在设计阶段就考虑，避免状态悬挂

**踩坑**
- Vitest `toHaveBeenCalledWith(a, b)` 严格区分 `(a,b)` 与 `(a,b,undefined)`——无选项参数时不要显式传 undefined
- 单行超长对象字面量易括号配平错误（oxc 报错难定位）——长对象拆多行
- edit 工具多处替换一处冲突 → 整批原子失败（签名/泛型修复需重新应用）
- pi 的 AgentToolResult 无 isError 字段（旧代码字段已随 pi 版本消失）——错误语义查文档确认：execute 错误应抛异常
- extension_ui_request 的 input 请求只有 title/placeholder 字段，无 prompt 字段——提问文本须放入 title

**工具反馈**
- 并行 spawn 同一 agent（test-writer × 2）触发了底层消息丢失 bug——工作流本身是并发模型的使用者，暴露了设计盲区
- spawn 返回 "No result provided" 时任务可能已实际完成（文件已产出）——结果消息丢失与任务失败的区分成本高

## 5. 后续待办

**立即跟进**
- 真实 pi 环境 smoke 验证 3 个待验证点：① 子进程 `message_start` 事件触发（ask_parent 计数重置时机）② 运行期会话历史延续行为 ③ 并发串行队列化真实进程验证
- smoke 通过后补写 `logs/` 之外的集成验证记录并更新本报告结论

**长期备忘**
- 引用：`D:/w_dev/intent-flow/.intentflow/agent-communication/later-on.md`（持久化会话跨重启续接、并发多通道、异步主动推送、busy 时排队消息、结构化提问、会话时间线、通信历史审计、群组通信、非 pi 子进程接入）

## 6. 开发工作流反馈

- **通信类设计须把并发作为一等公民**：requirement/design 阶段未预见到"同一 agent 并发派发"场景（单会话模型隐含假设），真实工作流（并行 test-writer）直接触发。后续涉及进程/通道/会话的 feature，设计时应明确并发语义（排队/拒绝/多通道）。
- **隔离 TDD 的并行派发与底层并发模型耦合**：test-writer 并行 spawn 依赖底层进程池的并发正确性——工作流自身成为被测系统的压力测试。可选改进：test-writer 派发串行化，或底层并发正确性先行（先有并发测试再开放并行派发）。
- **直接模式 vs 隔离 TDD 判定**：对薄逻辑文件（AgentMessagingService 等 20 行包装）强制走隔离 TDD 成本偏高；当前判据（"运行时行为验证"）可补充"逻辑复杂度阈值"维度。

## 7. 结论

- **当前状态：需补测**。类型系统与单元测试全绿（tsc 0 错误、vitest 127 通过、vite build 成功），但真实 pi 环境的行为验证（子进程通道、会话延续、并发串行）未执行。
- **建议下一步**：在真实 pi 会话中 smoke 验证 agent_request 派发 → ask_parent 提问 → reply → result 全链路，以及并发 send 同一 agent；验证通过后即可发布。
