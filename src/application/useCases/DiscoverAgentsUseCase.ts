/**
 * @intent 发现 agent 用例。编排 IAgentRepository.discoverAll() 扫描文件系统，
 * 返回 AgentDefinition[] + 错误列表。输入 AgentScope，输出 AgentDiscoveryResult。
 * Phase 1 完整实现，透传仓库层的发现结果。
 */

import type { IUseCase } from './IUseCase';
import type { AgentDiscoveryResult, AgentScope } from '../data/entities/AgentDefinition';
import type { IAgentRepository } from '../data/repositories/IAgentRepository';

// ==================== 输入/输出类型 ====================

export interface DiscoverAgentsInput {
  /** 发现作用域 */
  scope: AgentScope;
}

export type DiscoverAgentsOutput = AgentDiscoveryResult;

export interface IDiscoverAgentsUseCase extends IUseCase<DiscoverAgentsInput, DiscoverAgentsOutput> {}

// ==================== UseCase 实现 ====================

export class DiscoverAgentsUseCase implements IDiscoverAgentsUseCase {
  constructor(private agentRepo: IAgentRepository) {}

  /**
   * @contract execute(input: DiscoverAgentsInput) => Promise<DiscoverAgentsOutput>
   * @step 透传 scope 参数到 IAgentRepository.discoverAll()
   * @boundary scope 无效时由仓库层决定默认行为
   */
  async execute(input: DiscoverAgentsInput): Promise<DiscoverAgentsOutput> {
    return this.agentRepo.discoverAll(input.scope);
  }
}
