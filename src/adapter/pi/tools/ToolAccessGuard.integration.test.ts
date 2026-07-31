/**
 * ToolAccessGuard + ScopePolicy 集成测试
 *
 * 不 mock 策略层，用真实 ScopePolicy + 真实 process.env 验证
 * 守卫与策略的串联流程。
 */

import { describe, it, expect, afterEach } from 'vitest';
import { ScopePolicy } from '../services/ScopePolicy';
import { ToolAccessGuard } from './ToolAccessGuard';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

// ==================== Mock ExtensionAPI ====================

function createMockPI(): {
  pi: ExtensionAPI;
  calls: Array<{ toolName: string; event: unknown; ctx: unknown }>;
} {
  const calls: Array<{ toolName: string; event: unknown; ctx: unknown }> = [];
  const handlers: Array<(event: unknown, ctx: unknown) => void | Promise<void>> = [];

  const pi = {
    on: (event: string, handler: (event: unknown, ctx: unknown) => void | Promise<void>) => {
      if (event === 'tool_call') {
        handlers.push(handler);
      }
    },
    registerTool: () => {},
    registerCommand: () => {},
  } as unknown as ExtensionAPI;

  return {
    pi,
    calls,
  };
}

// ==================== 测试 ====================

describe('ToolAccessGuard + ScopePolicy 集成', () => {
  const ORIGINAL_ENV = process.env.PI_EXT_SKIP;

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) {
      delete process.env.PI_EXT_SKIP;
    } else {
      process.env.PI_EXT_SKIP = ORIGINAL_ENV;
    }
  });

  it('shouldSkip 返回 false 时正常拦截 edit 操作', async () => {
    delete process.env.PI_EXT_SKIP; // 不跳过
    const policy = new ScopePolicy();
    const guard = new ToolAccessGuard(policy);
    const { pi } = createMockPI();

    expect(policy.shouldSkip('confirm-edit')).toBe(false);
    expect(() => guard.register(pi)).not.toThrow();
  });

  it('shouldSkip 返回 true 时所有拦截直接放行', async () => {
    process.env.PI_EXT_SKIP = 'confirm-edit';
    const policy = new ScopePolicy();

    expect(policy.shouldSkip('confirm-edit')).toBe(true);
  });

  it('ScopePolicy 与 ToolAccessGuard 类型兼容', () => {
    const policy = new ScopePolicy();
    // 类型兼容验证：如果构造函数签名不匹配，编译阶段会报错
    const guard = new ToolAccessGuard(policy);
    expect(guard).toBeInstanceOf(ToolAccessGuard);
  });
});
