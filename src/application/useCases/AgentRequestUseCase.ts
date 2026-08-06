/**
 * @intent
 * agent_request 合成原语用例。send + 首次 await 的组合：校验 agent 存在、
 * 组装任务消息（task + context）、默认超时，返回 question/result/timeout/error 统一出口。
 * 提问-回答循环由主 agent 用 request/await + reply 组合完成
 * （工具执行期间主 agent 模型不运行，无法在用例内部代答）。
 *
 * 边界：agent 不存在时抛错；model/skipExts 仅进程级生效（透传，仅首次 spawn 有效）；
 * 不包含提问子循环（提问原样透出给调用方）；超时默认 600000。
 *
 * 验收条件：
 * - agent 不存在抛 "Agent not found: ..."
 * - question/result/timeout/error 原样透传（不吞不改）
 * - task + context 拼装规则：context 以 "## 上下文" 段追加
 */

import type { IAgentRepository } from '../services/agentRepository';
import type { IAgentMessagingService, AgentAwaitResult } from '../services/IAgentMessagingService';

// ==================== 输入/输出类型 ====================

export interface AgentRequestInput {
  /** Agent 名称 */
  agent: string;
  /** 任务描述（首条消息） */
  task: string;
  /** 可选上下文（追加到消息末尾） */
  context?: string;
  /** 可选模型覆盖（进程级，仅首次 spawn 生效） */
  model?: string;
  /** 超时毫秒（默认 600000） */
  timeoutMs?: number;
  /** 子 agent 中跳过拦截的扩展名列表（进程级，仅首次 spawn 生效） */
  skipExts?: string[];
  /** 子进程中间事件回调（可视化） */
  onEvent?: (event: Record<string, unknown>) => void;
}

export interface AgentRequestOutput {
  /** 首次 await 的结果（question/result/timeout/error） */
  result: AgentAwaitResult;
}

// ==================== 用例实现 ====================

export class AgentRequestUseCase {
  constructor(
    private agentRepo: IAgentRepository,
    private messaging: IAgentMessagingService,
  ) {}

  /**
   * @contract execute(input: AgentRequestInput) => Promise<AgentRequestOutput>
   * @step [校验] agent 存在性（findByName scope='sub_skill'）
   * @step [组装] task + context（"## 上下文" 段）
   * @step [发送] send(agent, message, { model, skipExts }?)——进程级选项仅传入时携带
   * @step [等待] await(agent, timeoutMs ?? 600000)
   * @step [返回] AgentAwaitResult 原样透传
   */
  async execute(input: AgentRequestInput): Promise<AgentRequestOutput> {
    const agent = await this.agentRepo.findByName(input.agent, 'sub_skill');
    if (!agent) {
      throw new Error(`Agent not found: "${input.agent}"`);
    }

    // 组装消息：task + context
    let message = input.task;
    if (input.context) {
      message = `${message}\n\n## 上下文\n\n${input.context}`;
    }

    // 进程级选项（仅传入时携带，避免与缺省值耦合）
    const options: { model?: string; skipExts?: string[]; onEvent?: (event: Record<string, unknown>) => void } = {};
    if (input.model) options.model = input.model;
    if (input.skipExts && input.skipExts.length > 0) options.skipExts = input.skipExts;
    if (input.onEvent) options.onEvent = input.onEvent;

    if (Object.keys(options).length > 0) {
      await this.messaging.send(input.agent, message, options);
    } else {
      await this.messaging.send(input.agent, message);
    }

    const result = await this.messaging.await(input.agent, input.timeoutMs ?? 10 * 60 * 1000);

    return { result };
  }
}
