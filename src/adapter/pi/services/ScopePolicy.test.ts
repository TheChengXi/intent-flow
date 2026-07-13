/**
 * @file ScopePolicy.test.ts
 * @description 测试 ScopePolicy 桥接实现 —— 委托 data/services/scope/policy.shouldSkip()
 *
 * 测试范围：
 * - 实现 IAccessPolicy 接口（shouldSkip 方法签名）
 * - 委托行为：调用 shouldSkip() 并返回一致结果
 * - 三种环境变量场景：包含 skip / 不包含 skip / 未设置
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScopePolicy } from './ScopePolicy';

// mock data 层纯函数
vi.mock('../../../data/services/scope/policy.js', () => ({
  shouldSkip: vi.fn(),
}));

// 在 vi.mock 之后导入，确保 mock 已生效
import { shouldSkip as mockShouldSkip } from '../../../data/services/scope/policy.js';

describe('ScopePolicy', () => {
  let policy: ScopePolicy;

  beforeEach(() => {
    policy = new ScopePolicy();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('实现 IAccessPolicy 接口', () => {
    it('shouldSkip 方法应存在且返回 boolean', () => {
      mockShouldSkip.mockReturnValueOnce(false);
      const result = policy.shouldSkip('confirm-edit');
      expect(typeof result).toBe('boolean');
    });

    it('shouldSkip 应返回与 data 层委托一致的 boolean', () => {
      mockShouldSkip.mockReturnValueOnce(true);
      expect(policy.shouldSkip('confirm-edit')).toBe(true);

      mockShouldSkip.mockReturnValueOnce(false);
      expect(policy.shouldSkip('confirm-edit')).toBe(false);
    });
  });

  describe('委托行为验证', () => {
    it('应委托 data/services/scope/policy.shouldSkip 并透传参数', () => {
      mockShouldSkip.mockReturnValue(false);
      policy.shouldSkip('confirm-edit');
      expect(mockShouldSkip).toHaveBeenCalledWith('confirm-edit');
    });

    it('多次调用应每次委托一次', () => {
      mockShouldSkip.mockReturnValue(false);
      policy.shouldSkip('confirm-edit');
      policy.shouldSkip('confirm-edit');
      expect(mockShouldSkip).toHaveBeenCalledTimes(2);
    });

    it('不同扩展名参数应透传', () => {
      mockShouldSkip.mockReturnValue(false);
      policy.shouldSkip('confirm-edit');
      expect(mockShouldSkip).toHaveBeenCalledWith('confirm-edit');

      policy.shouldSkip('permission-gate');
      expect(mockShouldSkip).toHaveBeenCalledWith('permission-gate');
    });
  });

  describe('环境变量 PI_EXT_SKIP 场景（通过 mock 上层函数间接覆盖）', () => {
    afterEach(() => {
      delete process.env.PI_EXT_SKIP;
    });

    it('PI_EXT_SKIP 包含 "confirm-edit" → shouldSkip("confirm-edit") 返回 true', () => {
      mockShouldSkip.mockReturnValue(true);
      process.env.PI_EXT_SKIP = 'confirm-edit,other-ext';
      expect(policy.shouldSkip('confirm-edit')).toBe(true);
    });

    it('PI_EXT_SKIP 不包含 "confirm-edit" → shouldSkip("confirm-edit") 返回 false', () => {
      mockShouldSkip.mockReturnValue(false);
      process.env.PI_EXT_SKIP = 'some-other-ext';
      expect(policy.shouldSkip('confirm-edit')).toBe(false);
    });

    it('PI_EXT_SKIP 未设置 → shouldSkip("confirm-edit") 返回 false', () => {
      mockShouldSkip.mockReturnValue(false);
      delete process.env.PI_EXT_SKIP;
      expect(policy.shouldSkip('confirm-edit')).toBe(false);
    });
  });
});
