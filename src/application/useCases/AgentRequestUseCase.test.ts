/**
 * @intent
 * 测试 agent_request 合成原语用例 AgentRequestUseCase 的 execute() 公开接口。
 * 依赖注入 mock IAgentRepository / IAgentMessagingService，验证：
 * - agent 存在性校验（不存在 → reject 'Agent not found'，且不触碰 messaging）
 * - send 参数组装（task 原样 / task + context、model / skipExts 透传、缺省时不带选项）
 * - await 超时默认值（600000）与 timeoutMs 透传
 * - await 返回（question/result/timeout/error）原样透传为 { result }
 * - findByName 的 scope 固定为 'sub_skill'
 *
 * 设计原则：
 * - 只测公开接口 execute()
 * - 不 mock 内部逻辑，通过断言 send/await 调用参数间接验证行为
 * - 每个测试一个关注点
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
import { AgentRequestUseCase } from './AgentRequestUseCase';
import type { AgentRequestInput } from './AgentRequestUseCase';
import type { IAgentRepository, AgentDefinition, AgentScope, AgentDiscoveryResult } from '../services/agentRepository';
import type {
  IAgentMessagingService,
  AgentAwaitResult,
  AgentQuestion,
  AgentRunResult,
} from '../services/IAgentMessagingService';

// ----------------------------------------------------------------
// Helper: 构造默认输入 / mock 依赖 / 实体样例
// ----------------------------------------------------------------

function makeInput(overrides: Partial<AgentRequestInput> = {}): AgentRequestInput {
  return { agent: 'agent-a', task: '完成任务', ...overrides };
}

/** 默认返回非 null 的 agent 定义 */
function makeAgent(): AgentDefinition {
  return {
    name: 'agent-a',
    description: '测试 agent',
    systemPrompt: '',
    tools: [],
    model: 'x',
    source: 'sub_skill',
    skillName: 'test-skill',
    filePath: '/fake/SUB-SKILL.md',
  };
}

function makeRunResult(overrides: Partial<AgentRunResult> = {}): AgentRunResult {
  return {
    agent: 'agent-a',
    exitCode: 0,
    output: 'done',
    usage: { input: 10, output: 5, cost: 0, turns: 1 },
    durationMs: 100,
    ...overrides,
  };
}

function createMockAgentRepo(): Mocked<IAgentRepository> {
  return {
    findByName: vi.fn<(name: string, scope: AgentScope) => Promise<AgentDefinition | null>>(),
    discoverAll: vi.fn<(scope: AgentScope) => Promise<AgentDiscoveryResult>>(),
  };
}

function createMockMessaging(): Mocked<IAgentMessagingService> {
  return {
    send: vi.fn<(agent: string, message: string, options?: { skipExts?: string[]; model?: string }) => Promise<void>>(),
    await: vi.fn<(agent: string, timeoutMs?: number) => Promise<AgentAwaitResult>>(),
    reply: vi.fn<(agent: string, answer: string) => Promise<void>>(),
    close: vi.fn<(agent: string) => Promise<void>>(),
  };
}

// ----------------------------------------------------------------
// 测试套件
// ----------------------------------------------------------------
describe('AgentRequestUseCase', () => {
  let mockRepo: ReturnType<typeof createMockAgentRepo>;
  let mockMessaging: ReturnType<typeof createMockMessaging>;
  let useCase: AgentRequestUseCase;

  beforeEach(() => {
    mockRepo = createMockAgentRepo();
    mockMessaging = createMockMessaging();
    useCase = new AgentRequestUseCase(mockRepo, mockMessaging);
    // 默认：agent 存在，await 返回 timeout（各测试按需覆盖）
    mockRepo.findByName.mockResolvedValue(makeAgent());
    mockMessaging.await.mockResolvedValue({ kind: 'timeout' });
  });

  // ─────────────────────────────────────────────
  // agent 存在性校验
  // ─────────────────────────────────────────────
  describe('agent existence check', () => {
    it('agent 不存在时 execute reject（错误包含 Agent not found），且不调用 send/await', async () => {
      mockRepo.findByName.mockResolvedValue(null);

      await expect(useCase.execute(makeInput({ agent: 'ghost' }))).rejects.toThrow(/Agent not found/);

      expect(mockMessaging.send).not.toHaveBeenCalled();
      expect(mockMessaging.await).not.toHaveBeenCalled();
    });

    it('findByName 以 sub_skill 作用域查找 agent', async () => {
      await useCase.execute(makeInput());

      expect(mockRepo.findByName).toHaveBeenCalledWith('agent-a', 'sub_skill');
    });
  });

  // ─────────────────────────────────────────────
  // send 参数组装
  // ─────────────────────────────────────────────
  describe('send arguments', () => {
    it('基本路径：send 收到 (agent, task)，await 收到默认超时 (agent, 600000)', async () => {
      await useCase.execute(makeInput());

      expect(mockMessaging.send).toHaveBeenCalledWith('agent-a', '完成任务');
      expect(mockMessaging.await).toHaveBeenCalledWith('agent-a', 600000);
    });

    it('未传 context 时 send 的消息为 task 原样', async () => {
      await useCase.execute(makeInput({ task: '原样任务文本' }));

      expect(mockMessaging.send).toHaveBeenCalledWith('agent-a', '原样任务文本');
    });

    it('传入 context 时 send 的消息为 task + 上下文分隔段', async () => {
      await useCase.execute(makeInput({ task: '重构模块', context: '文件在 src/x.ts' }));

      expect(mockMessaging.send).toHaveBeenCalledWith(
        'agent-a',
        '重构模块\n\n## 上下文\n\n文件在 src/x.ts',
      );
    });

    it('传入 model 与 skipExts 时 send 第三参数收到 { model, skipExts }', async () => {
      await useCase.execute(makeInput({ model: 'gpt-4o', skipExts: ['.md', '.log'] }));

      expect(mockMessaging.send).toHaveBeenCalledWith('agent-a', '完成任务', {
        model: 'gpt-4o',
        skipExts: ['.md', '.log'],
      });
    });

    it('未传 model/skipExts 时 send 不带进程级选项（undefined 或空对象）', async () => {
      await useCase.execute(makeInput());

      const options = mockMessaging.send.mock.calls[0][2];
      expect(options === undefined || Object.keys(options).length === 0).toBe(true);
    });

    it('传入 onEvent 时透传给 send 的 options', async () => {
      const onEvent = vi.fn();
      await useCase.execute(makeInput({ onEvent }));

      expect(mockMessaging.send.mock.calls[0][2]?.onEvent).toBe(onEvent);
    });
  });

  // ─────────────────────────────────────────────
  // await 超时参数
  // ─────────────────────────────────────────────
  describe('await timeout', () => {
    it('传入 timeoutMs 时 await 收到该值', async () => {
      await useCase.execute(makeInput({ timeoutMs: 30000 }));

      expect(mockMessaging.await).toHaveBeenCalledWith('agent-a', 30000);
    });
  });

  // ─────────────────────────────────────────────
  // await 返回原样透传
  // ─────────────────────────────────────────────
  describe('await result passthrough', () => {
    it('await 返回 question 时 execute 返回 { result: question } 原样透传', async () => {
      const question: AgentQuestion = {
        kind: 'question',
        question: '需要澄清什么?',
        requestId: 'req-1',
        askCount: 1,
      };
      mockMessaging.await.mockResolvedValue(question);

      const out = await useCase.execute(makeInput());

      expect(out).toEqual({ result: question });
    });

    it('await 返回 result 时 execute 返回 { result: result } 原样透传', async () => {
      const runResult = makeRunResult({ output: '子 agent 完成输出' });
      mockMessaging.await.mockResolvedValue({ kind: 'result', result: runResult });

      const out = await useCase.execute(makeInput());

      expect(out).toEqual({ result: { kind: 'result', result: runResult } });
    });

    it('await 返回 timeout 时 execute 返回 { result: timeout } 原样透传', async () => {
      mockMessaging.await.mockResolvedValue({ kind: 'timeout' });

      const out = await useCase.execute(makeInput());

      expect(out).toEqual({ result: { kind: 'timeout' } });
    });

    it('await 返回 error 时 execute 返回 { result: error } 原样透传', async () => {
      mockMessaging.await.mockResolvedValue({ kind: 'error', message: '子进程崩溃' });

      const out = await useCase.execute(makeInput());

      expect(out).toEqual({ result: { kind: 'error', message: '子进程崩溃' } });
    });
  });
});
