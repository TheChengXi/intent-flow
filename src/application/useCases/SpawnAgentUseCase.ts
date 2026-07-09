/**
 * @intent 运行 agent 用例。接收 agent 名称+任务，通过 IAgentRepository.findByName()
 * 查找定义，通过 ISubProcessRunner.run() 在子进程运行，返回 AgentRunResult。
 * Phase 1 完整实现单次模式。
 */

import type { IUseCase } from './IUseCase';
import type { AgentRunResult } from '../data/entities/AgentRunResult';
import type { IAgentRepository } from '../data/repositories/IAgentRepository';
import type { ISubProcessRunner } from '../data/repositories/ISubProcessRunner';

// ==================== 输入/输出类型 ====================

export interface SpawnAgentInput {
  /** Agent 名称 */
  agent: string;
  /** 任务描述 */
  task: string;
  /** 可选上下文（追加到 system prompt 末尾） */
  context?: string;
  /** 可选模型覆盖 */
  model?: string;
  /** 超时毫秒（默认 600000 = 10 分钟） */
  timeoutMs?: number;
  /** 工作目录（默认 process.cwd()） */
  cwd?: string;
  /** 子进程中间事件回调（用于可视化） */
  onEvent?: (event: Record<string, unknown>) => void;
  /** 子 agent 中跳过拦截的扩展名列表 */
  skipExts?: string[];
}

export interface SpawnAgentOutput {
  /** 运行结果 */
  result: AgentRunResult;
}

export interface ISpawnAgentUseCase extends IUseCase<SpawnAgentInput, SpawnAgentOutput> {}

// ==================== UseCase 实现 ====================

export class SpawnAgentUseCase implements ISpawnAgentUseCase {
  constructor(
    private agentRepo: IAgentRepository,
    private runner: ISubProcessRunner,
  ) {}

  /**
   * @contract execute(input: SpawnAgentInput) => Promise<SpawnAgentOutput>
   * @step [查找 agent] 通过 IAgentRepository.findByName() 获取 AgentDefinition
   * @step [构造参数] 组装 SubProcessRunParams（含 timeout、cwd 等默认值）
   * @step [运行] 通过 ISubProcessRunner.run() 启动子进程
   * @step [返回] 返回 AgentRunResult
   * @boundary agent 不存在时抛出错误
   * @boundary 子进程运行失败时在 result 中体现（exitCode !== 0）
   */
  async execute(input: SpawnAgentInput): Promise<SpawnAgentOutput> {
    const agent = await this.agentRepo.findByName(input.agent, 'sub_skill');

    if (!agent) {
      throw new Error(`Agent not found: "${input.agent}"`);
    }

    const result = await this.runner.run({
      agentName: agent.name,
      systemPrompt: agent.systemPrompt,
      task: input.task,
      tools: agent.tools,
      model: input.model || agent.model,
      timeoutMs: input.timeoutMs ?? 10 * 60 * 1000,
      cwd: input.cwd || process.cwd(),
      context: input.context,
      skipExts: input.skipExts,
      onEvent: input.onEvent,
    });

    return { result };
  }
}
