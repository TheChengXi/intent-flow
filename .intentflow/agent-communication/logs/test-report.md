# 测试工作报告：AgentRequestUseCase

## 文件路径
- 被测文件：`src/application/useCases/AgentRequestUseCase.ts`
- 测试文件：`src/application/useCases/AgentRequestUseCase.test.ts`

## 接口签名（实现契约）

```typescript
export interface AgentRequestInput {
  agent: string;
  task: string;
  context?: string;
  model?: string;
  timeoutMs?: number;
  skipExts?: string[];
}

export interface AgentRequestOutput {
  result: AgentAwaitResult; // question | result | timeout | error
}

export class AgentRequestUseCase {
  constructor(agentRepo: IAgentRepository, messaging: IAgentMessagingService);
  execute(input: AgentRequestInput): Promise<AgentRequestOutput>;
}
```

依赖接口（构造注入，均为 mock）：
- `IAgentRepository.findByName(name: string, scope: AgentScope): Promise<AgentDefinition | null>`
- `IAgentMessagingService.send(agent, message, options?: { skipExts?: string[]; model?: string }): Promise<void>`
- `IAgentMessagingService.await(agent, timeoutMs?: number): Promise<AgentAwaitResult>`
- `reply / close`：mock 中提供（与本用例无关）

## 覆盖的测试场景（12 条，每条约一个关注点）

| # | 场景 | 关键断言 |
|---|------|---------|
| 1 | agent 不存在（findByName → null） | execute reject 且错误包含 'Agent not found'；send / await 均不被调用 |
| 2 | 基本路径 | send 收到 `(agent, task)`；await 收到默认超时 `(agent, 600000)` |
| 3 | timeoutMs 传入 | await 收到该值 |
| 4 | model + skipExts 传入 | send 第三参数收到 `{ model, skipExts }` |
| 5 | model/skipExts 未传 | send 第三参数为 undefined 或空对象（不耦合实现细节） |
| 6 | context 传入 | send 消息 = `task + '\n\n## 上下文\n\n' + context` |
| 7 | context 未传 | send 消息 = task 原样 |
| 8 | await 返回 question | execute 返回 `{ result: question }` 原样透传（含 kind/question/requestId/askCount） |
| 9 | await 返回 result | execute 返回 `{ result: result }` 原样透传（含 kind/result/AgentRunResult） |
| 10 | await 返回 timeout | execute 返回 `{ result: { kind: 'timeout' } }` 原样透传 |
| 11 | findByName scope | 以 `'sub_skill'` 作用域查找 |
| 12 | await 返回 error（统一出口补充） | execute 返回 `{ result: { kind: 'error', message } }` 原样透传 |

## 测试风格
- vitest：`describe / it / expect / vi / beforeEach`，`Mocked<T>` 类型化 mock
- 只测公开接口 `execute()`，通过断言 mock 调用参数间接验证行为
- 每个测试一个关注点，测试名中文描述场景
- 顶部 `@intent` 注释说明测试对象与覆盖范围
- mock 工厂：`createMockAgentRepo` / `createMockMessaging` / `makeAgent` / `makeRunResult` / `makeInput`
- 默认 `findByName` 返回非 null 的 AgentDefinition，各测试按需覆盖

## 验证结果
- `npx vitest run src/application/useCases/AgentRequestUseCase.test.ts`：12 条测试全部执行（当前全部失败，原因是被测类为未实现 stub，`execute` 抛 `AgentRequestUseCase 未实现`——符合 TDD 预期，实现填充后应全部通过）
- 测试文件本身零类型错误（`tsc --noEmit` 输出中无 `AgentRequestUseCase.test.ts` 相关错误；tsc 报告的 3 条 AgentRequestUseCase 错误均位于源 stub 文件内，属预期）
- 未修改任何源文件

---

# 测试工作报告：MessageRouterImpl

## 文件路径
- 被测文件：`src/adapter/pi/runtime/MessageRouter.ts`
- 测试文件：`src/adapter/pi/runtime/MessageRouter.test.ts`

## 接口签名（实现契约）

```typescript
import type { AgentAwaitResult, AgentQuestion, AgentRunResult } from '../../../application/services/IAgentMessagingService';

export class MessageRouterImpl {
  handleLine(agent: string, line: string): AgentAwaitResult | null;
  dequeuePending(agent: string): AgentQuestion | null;
}
```

## 覆盖的测试场景（12 条，每条约一个关注点）

| # | 场景 | 关键断言 |
|---|------|---------|
| 1 | handleLine 收到非 JSON 行 | 返回 null |
| 2 | extension_ui_request（method=input） | 返回 `{ kind:'question', question=title, requestId=id, askCount:1 }` |
| 3 | 同一 agent 连续两次提问 | 第二次返回的 question 其 askCount=2 |
| 4 | 不同 agent（a/b）提问 | askCount 各自独立从 1 开始 |
| 5 | agent_end → result | kind='result'；result.agent=agent 名；无 errorMessage 时 exitCode=0；output=assistant 文本 trim 后；usage.turns/input/output/cost 累加；model=最后一条 assistant；messages 透传（深比较） |
| 6 | agent_end 含 errorMessage 的 assistant | exitCode=1 且 error=errorMessage |
| 7 | agent_end 多条 assistant（含 user 消息） | turns=assistant 条数（2）；input/output/cost 累加（300/200/0.03）；model 取最后一条；output 为文本拼接 |
| 8 | 其他事件（message_end、tool_result_end、未知对象） | 返回 null |
| 9 | extension_ui_request 但 method 非 input（confirm/notify） | 返回 null |
| 10 | dequeuePending 无排队 | 返回 null |
| 11 | 同 agent 入队两个提问后 dequeuePending | FIFO：第一次返回第一个提问且 askCount=2（剩余 1 个），第二次返回第二个提问且 askCount=1（剩余 0 个），第三次返回 null |
| 12 | agent_end 之后 | 同 agent 提问队列被清空，dequeuePending 返回 null |

## 测试风格
- vitest：`describe / it / expect / beforeEach`
- 只测公开接口 `handleLine / dequeuePending`，不触碰内部状态
- 每个测试一个关注点，测试名中文描述场景
- 顶部 `@intent` 注释说明测试对象与覆盖范围
- 事件行用 `JSON.stringify` 构造（JSONL 单行），helper：`questionEvent / endEvent / expectResultMessage`

## 验证结果
- `npx vitest run src/adapter/pi/runtime/MessageRouter.test.ts`：12 条测试全部通过（当前实现与规格一致）
- `npx tsc --noEmit` 输出中无 `MessageRouter.test.ts` 相关错误
- 未修改任何源文件
