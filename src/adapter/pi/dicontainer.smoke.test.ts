/**
 * @intent
 * pi adapter DI 容器组装冒烟测试：验证 DIContainer 能实例化全部依赖、跨层注入正确（data 实现注入 application 用例），并跑通真实 agent 发现。
 * 边界：依赖真实 ~/.pi/agent 目录；测试间用环境变量隔离。
 * 验收条件：
 * - 容器可单例获取且各依赖构造器名符合预期
 */

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
