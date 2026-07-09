/**
 * DiscoverAgentsUseCase 单元测试
 */

import { describe, it, expect, vi } from 'vitest';
import { DiscoverAgentsUseCase } from './DiscoverAgentsUseCase';
import type { IAgentRepository } from '../data/repositories/IAgentRepository';

describe('DiscoverAgentsUseCase', () => {
  it('透传 scope 到仓库并返回结果', async () => {
    const agentRepo: IAgentRepository = {
      discoverAll: vi.fn().mockResolvedValue({
        agents: [
          { name: 'a', description: 'A', systemPrompt: '', source: 'sub_skill', filePath: '' },
        ],
        errors: [],
      }),
      findByName: vi.fn(),
    };

    const useCase = new DiscoverAgentsUseCase(agentRepo);
    const result = await useCase.execute({ scope: 'sub_skill' });

    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].name).toBe('a');
    expect(agentRepo.discoverAll).toHaveBeenCalledWith('sub_skill');
  });
});
