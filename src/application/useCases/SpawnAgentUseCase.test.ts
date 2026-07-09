/**
 * SpawnAgentUseCase 单元测试
 */

import { describe, it, expect, vi } from 'vitest';
import { SpawnAgentUseCase } from './SpawnAgentUseCase';
import type { IAgentRepository } from '../data/repositories/IAgentRepository';
import type { ISubProcessRunner } from '../data/repositories/ISubProcessRunner';
import type { AgentDefinition } from '../data/entities/AgentDefinition';

function createMockAgent(overrides?: Partial<AgentDefinition>): AgentDefinition {
  return {
    name: 'test-agent',
    description: 'Test agent',
    systemPrompt: '# Test\n\nDo stuff.',
    source: 'sub_skill',
    skillName: 'test-skill',
    filePath: '/fake/path/SUB-SKILL.md',
    ...overrides,
  };
}

describe('SpawnAgentUseCase', () => {
  it('找到 agent 并运行，返回结果', async () => {
    const mockAgent = createMockAgent();
    const agentRepo: IAgentRepository = {
      discoverAll: vi.fn(),
      findByName: vi.fn().mockResolvedValue(mockAgent),
    };
    const runner: ISubProcessRunner = {
      run: vi.fn().mockResolvedValue({
        agent: 'test-agent',
        exitCode: 0,
        output: 'Task completed',
        usage: { input: 100, output: 50, cost: 0.002, turns: 2 },
        durationMs: 1500,
      }),
    };

    const useCase = new SpawnAgentUseCase(agentRepo, runner);
    const result = await useCase.execute({ agent: 'test-agent', task: 'do something' });

    expect(result.result.agent).toBe('test-agent');
    expect(result.result.exitCode).toBe(0);
    expect(result.result.output).toBe('Task completed');
    expect(agentRepo.findByName).toHaveBeenCalledWith('test-agent', 'sub_skill');
    expect(runner.run).toHaveBeenCalledTimes(1);
  });

  it('agent 不存在时抛错', async () => {
    const agentRepo: IAgentRepository = {
      discoverAll: vi.fn(),
      findByName: vi.fn().mockResolvedValue(null),
    };
    const runner: ISubProcessRunner = {
      run: vi.fn(),
    };

    const useCase = new SpawnAgentUseCase(agentRepo, runner);

    await expect(
      useCase.execute({ agent: 'ghost', task: 'nothing' }),
    ).rejects.toThrow('Agent not found: "ghost"');
  });

  it('传递 context 到 runner', async () => {
    const mockAgent = createMockAgent();
    const agentRepo: IAgentRepository = {
      discoverAll: vi.fn(),
      findByName: vi.fn().mockResolvedValue(mockAgent),
    };
    const runner: ISubProcessRunner = {
      run: vi.fn().mockResolvedValue({
        agent: 'test-agent',
        exitCode: 0,
        output: '',
        usage: { input: 0, output: 0, cost: 0, turns: 0 },
        durationMs: 0,
      }),
    };

    const useCase = new SpawnAgentUseCase(agentRepo, runner);
    await useCase.execute({
      agent: 'test-agent',
      task: 'task',
      context: 'previous output',
      model: 'claude-haiku',
      timeoutMs: 10000,
      cwd: '/tmp',
    });

    expect(runner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        agentName: 'test-agent',
        context: 'previous output',
        model: 'claude-haiku',
        timeoutMs: 10000,
        cwd: '/tmp',
      }),
    );
  });

  it('默认 timeoutMs 为 10 分钟', async () => {
    const mockAgent = createMockAgent();
    const agentRepo: IAgentRepository = {
      discoverAll: vi.fn(),
      findByName: vi.fn().mockResolvedValue(mockAgent),
    };
    const runner: ISubProcessRunner = {
      run: vi.fn().mockResolvedValue({
        agent: 'test-agent',
        exitCode: 0,
        output: '',
        usage: { input: 0, output: 0, cost: 0, turns: 0 },
        durationMs: 0,
      }),
    };

    const useCase = new SpawnAgentUseCase(agentRepo, runner);
    await useCase.execute({ agent: 'test-agent', task: 'task' });

    expect(runner.run).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 600000 }),
    );
  });
});
