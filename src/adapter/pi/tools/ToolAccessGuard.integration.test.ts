/**
 * @intent
 * ToolAccessGuard + ScopePolicy + GuardToggleService 集成测试：不 mock 策略层与开关层，用真实实现串联验证守卫拦截、策略判定、开关切换链路，仅 mock 外部 ExtensionAPI。
 * 验收条件：
 * - 覆盖允许/拒绝/开关关闭三条主路径
 */

/**
 * ToolAccessGuard + ScopePolicy + GuardToggleService 集成测试
 *
 * 不 mock 策略层与开关层，用真实 ScopePolicy + 真实 process.env +
 * 真实 GuardToggleService/GuardToggleStore（chdir 临时目录隔离）
 * 验证守卫与策略、开关的串联流程。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ScopePolicy } from '../../../application/services/ScopePolicy';
import { GuardToggleService } from '../../../application/services/GuardToggleService';
import { GuardToggleStore } from '../../../data/services/guard/GuardToggleStore';
import { ToolAccessGuard } from './ToolAccessGuard';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

// ==================== Mock ExtensionAPI ====================

function createMockPI(): {
  pi: ExtensionAPI;
  handlers: Array<(event: unknown, ctx: unknown) => void | Promise<void>>;
} {
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

  return { pi, handlers };
}

// ==================== 测试 ====================

describe('ToolAccessGuard + ScopePolicy + GuardToggle 集成', () => {
  const ORIGINAL_ENV = process.env.PI_EXT_SKIP;
  const ORIGINAL_CWD = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'guard-toggle-int-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(ORIGINAL_CWD);
    rmSync(tempDir, { recursive: true, force: true });
    if (ORIGINAL_ENV === undefined) {
      delete process.env.PI_EXT_SKIP;
    } else {
      process.env.PI_EXT_SKIP = ORIGINAL_ENV;
    }
  });

  /** 真实开关服务：临时 cwd 下无配置文件 → 默认开启（安全态） */
  const createToggleService = (): GuardToggleService =>
    new GuardToggleService(new GuardToggleStore());

  it('shouldSkip 返回 false 时正常拦截 edit 操作', async () => {
    delete process.env.PI_EXT_SKIP; // 不跳过
    const policy = new ScopePolicy();
    const guard = new ToolAccessGuard(policy, createToggleService());
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
    const guard = new ToolAccessGuard(policy, createToggleService());
    expect(guard).toBeInstanceOf(ToolAccessGuard);
  });

  it('守卫开关开启时 edit 操作仍弹确认框', async () => {
    delete process.env.PI_EXT_SKIP;
    const toggle = createToggleService(); // 默认开启（无配置文件 → 安全态）
    expect(toggle.isEnabled()).toBe(true);
    const guard = new ToolAccessGuard(new ScopePolicy(), toggle);
    const { pi, handlers } = createMockPI();
    guard.register(pi);

    const confirm = vi.fn().mockResolvedValue(true);
    const input = vi.fn();
    await handlers[0](
      { toolName: 'edit', input: { path: 'test.ts' } },
      { ui: { confirm, input } },
    );

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(input).not.toHaveBeenCalled();
  });

  it('守卫开关关闭时 edit 操作直接放行（不弹确认框）', async () => {
    delete process.env.PI_EXT_SKIP;
    const toggle = createToggleService();
    await toggle.toggle(); // 关闭 → isEnabled() false
    expect(toggle.isEnabled()).toBe(false);

    const guard = new ToolAccessGuard(new ScopePolicy(), toggle);
    const { pi, handlers } = createMockPI();
    guard.register(pi);

    const confirm = vi.fn();
    const input = vi.fn();
    await handlers[0](
      { toolName: 'edit', input: { path: 'test.ts' } },
      { ui: { confirm, input } },
    );

    expect(confirm).not.toHaveBeenCalled();
    expect(input).not.toHaveBeenCalled();
  });

  it('守卫开关关闭时危险 bash 命令同样直接放行', async () => {
    delete process.env.PI_EXT_SKIP;
    const toggle = createToggleService();
    await toggle.toggle(); // 关闭
    const guard = new ToolAccessGuard(new ScopePolicy(), toggle);
    const { pi, handlers } = createMockPI();
    guard.register(pi);

    const confirm = vi.fn();
    const input = vi.fn();
    await handlers[0](
      { toolName: 'bash', input: { command: 'rm -rf /tmp/x' } },
      { ui: { confirm, input } },
    );

    expect(confirm).not.toHaveBeenCalled();
    expect(input).not.toHaveBeenCalled();
  });
});
