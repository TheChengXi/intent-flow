# 后续想法备忘（agent-communication）

> 与本次实现无关或超出边界的想法，按主题记录，供后续 feature 立项时检索。

## 通信能力演进

- **持久化会话跨重启续接**：RPC 子进程 session 已落盘，续接需解决会话寻址（子进程 session 与主 session 的映射、`--session-dir` 显式指定）与恢复策略（重启后如何定位旧会话）。触发条件：出现"跨主 session 重启继续同一协作"的真实场景。
- **并发多通道**：同一 agent 并行多个独立会话（当前单进程单会话模型）。需要 RPC 子进程多 session 支持或每通道独立进程，进程池要引入通道概念。触发条件：主 agent 需要同时与多个上下文并行协作。
- **异步主动推送**：子 agent 主动发消息唤醒主 agent（pi `sendMessage` + `triggerTurn` 可注入主会话并触发新回合）。当前主 agent 必须处于 await 才能感知子 agent 消息。触发条件：主 agent 被动接收消息场景（如子 agent 汇报进度后主 agent 主动决策）。
- **子进程 busy 时排队消息**：RPC 协议已支持 `streamingBehavior: steer/followUp`（子 agent 运行中排队消息，回合间投递）。当前 send 原语未暴露此能力。触发条件：主 agent 想在子 agent 忙碌时预置指令。

## ask_parent 增强

- **结构化提问**：ask_parent 支持选项（select 式），子 agent 给候选答案，主 agent 选择而非自由文本——减少往返、答案更可控。协议层 extension_ui_request 的 select method 已支持。
- **提问附上下文**：ask_parent 可携带子 agent 当前工作摘要/相关文件片段，减少主 agent 猜测成本。

## 可视化与可观测性

- **会话时间线视图**：当前复用"运行轨迹"（单条目多日志）；演进为消息流时间线（send/question/reply/result 结构化呈现），SubAgentView 升级。
- **通信历史审计**：会话消息（含提问/回答）落盘可查询，用于复盘多 agent 协作质量、token 成本归因。

## 协议与生态

- **群组/广播通信**：A2A 风格多 agent 网状协作（当前两两通信）。触发条件：多 agent 协作编排需求出现。
- **非 pi 子进程接入**：IAgentMessagingService 接口已抽象，未来可接其他 agent 运行时（若 pi 的 RPC 协议变化或出现新的 agent 宿主）。

## 已知待验证（实现时确认）

- ✅ 已确认：子进程通道用 `--extension <当前 bundle>` + `IFLOW_CHILD=1` 环境变量分支（extension.ts 检测后只注册 ask_parent），不依赖多入口打包。
- ✅ 已确认：extension_ui_request 的 input 请求只有 title/placeholder 字段 → ask_parent 将提问内容放入 title，主进程解析 title。
- ⚠️ 未验证：子进程 `pi.on('message_start')` 是否在每次 prompt 时触发（ask_parent 计数重置时机）；不可行则改为按工具调用窗口或主进程注入任务边界。
- ⚠️ 未验证：RPC 子进程默认 session 目录定位规则（"运行期会话"历史延续的行为边界——子进程不带 --no-session，历史应保留，需真实环境确认）。
- ⚠️ 未验证：并发串行队列化的真实进程验证（MessageRouter 单测已覆盖状态机，需真实 pi 环境 smoke 验证并发 send 同一 agent）。
