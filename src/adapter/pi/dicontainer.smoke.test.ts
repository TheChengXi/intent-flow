import { describe, it, expect, afterEach } from 'vitest';
import { DIContainer } from './DIContainer';
import { SCOPE_SKIP_ENV } from '../../application/services/IAccessPolicyService';

describe('DIContainer 组装冒烟（pi-adapter-layer-reorg）', () => {
  const oldEnv = process.env.PI_EXT_SKIP;

  afterEach(() => {
    if (oldEnv === undefined) delete process.env.PI_EXT_SKIP;
    else process.env.PI_EXT_SKIP = oldEnv;
  });

  it('agentRepo 来自 CoreDIContainer（data 层实现）', () => {
    const c = DIContainer.getInstance();
    expect(c.agentRepo.constructor.name).toBe('AgentRepositoryImpl');
  });

  it('accessPolicy 为 application 层 ScopePolicy', () => {
    const c = DIContainer.getInstance();
    expect(c.accessPolicy.constructor.name).toBe('ScopePolicy');
  });

  it('agent 发现可运行（真实 ~/.pi/agent 目录）', async () => {
    const c = DIContainer.getInstance();
    const result = await c.discoverAgentsUseCase.execute({ scope: 'sub_skill' });
    expect(Array.isArray(result.agents)).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('SCOPE_SKIP_ENV 常量经 application 透出', () => {
    expect(SCOPE_SKIP_ENV).toBe('PI_EXT_SKIP');
  });

  it('PI_EXT_SKIP 策略生效', () => {
    const c = DIContainer.getInstance();
    process.env.PI_EXT_SKIP = 'confirm-edit';
    expect(c.accessPolicy.shouldSkip('confirm-edit')).toBe(true);
    expect(c.accessPolicy.shouldSkip('bash')).toBe(false);
  });
});
