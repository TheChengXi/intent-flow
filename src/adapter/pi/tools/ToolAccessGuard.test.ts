/**
 * @file ToolAccessGuard.test.ts
 * @description 测试 ToolAccessGuard 工具访问守卫
 *
 * 测试范围：
 * - shouldSkip("confirm-edit") 放行场景
 * - edit/write 工具确认拦截
 * - bash 危险命令确认拦截
 * - isDangerousBash 规则覆盖
 * - 非目标工具放行
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ToolAccessGuard } from './ToolAccessGuard';
import type { IAccessPolicy } from '../../../application/services/IAccessPolicy';

// ── 类型辅助 ──

interface MockCtx {
  ui: {
    confirm: ReturnType<typeof vi.fn>;
    input: ReturnType<typeof vi.fn>;
  };
}

interface MockPi {
  on: ReturnType<typeof vi.fn>;
}

function createMockCtx(overrides?: {
  confirm?: ReturnType<typeof vi.fn>;
  input?: ReturnType<typeof vi.fn>;
}): MockCtx {
  return {
    ui: {
      confirm: overrides?.confirm ?? vi.fn(),
      input: overrides?.input ?? vi.fn(),
    },
  };
}

interface ToolEvent {
  toolName: string;
  input: Record<string, unknown>;
}

type ToolCallHandler = (event: ToolEvent, ctx: MockCtx) => Promise<unknown>;

// ── 用例 ──

describe('ToolAccessGuard', () => {
  let mockPolicy: IAccessPolicy;
  let mockPi: MockPi;
  let guard: ToolAccessGuard;
  /** register 注册的 tool_call 事件处理器 */
  let handler: ToolCallHandler;

  beforeEach(() => {
    mockPolicy = { shouldSkip: vi.fn().mockReturnValue(false) };
    mockPi = { on: vi.fn() };
    guard = new ToolAccessGuard(mockPolicy);
    guard.register(mockPi as never);
    handler = mockPi.on.mock.calls[0][1] as ToolCallHandler;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── shouldSkip 放行 ──────────────────────────────

  describe('shouldSkip 放行', () => {
    it('shouldSkip("confirm-edit") 返回 true → 直接放行，不弹确认框', async () => {
      mockPolicy.shouldSkip = vi.fn().mockReturnValue(true);
      const mockConfirm = vi.fn();
      const ctx = createMockCtx({ confirm: mockConfirm });

      const result = await handler(
        { toolName: 'edit', input: { path: 'test.ts' } },
        ctx,
      );

      expect(mockPolicy.shouldSkip).toHaveBeenCalledWith('confirm-edit');
      expect(mockConfirm).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  // ── edit / write 拦截 ───────────────────────────

  describe('edit 工具拦截', () => {
    it('用户确认 → 不 block', async () => {
      const mockConfirm = vi.fn().mockResolvedValue(true);
      const ctx = createMockCtx({ confirm: mockConfirm });

      const result = await handler(
        { toolName: 'edit', input: { path: 'src/foo.ts' } },
        ctx,
      );

      expect(mockConfirm).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('src/foo.ts'),
      );
      expect(result).toBeUndefined();
    });

    it('用户取消 → 询问原因 → block', async () => {
      const mockConfirm = vi.fn().mockResolvedValue(false);
      const mockInput = vi.fn().mockResolvedValue('不需要');
      const ctx = createMockCtx({ confirm: mockConfirm, input: mockInput });

      const result = await handler(
        { toolName: 'edit', input: { path: 'test.ts' } },
        ctx,
      );

      expect(mockConfirm).toHaveBeenCalledOnce();
      expect(mockInput).toHaveBeenCalledOnce();
      expect(result).toEqual({
        block: true,
        reason: '用户拒绝了修改: 不需要',
      });
    });

    it('用户取消且不输入原因 → 默认 reason', async () => {
      const mockConfirm = vi.fn().mockResolvedValue(false);
      const mockInput = vi.fn().mockResolvedValue('');
      const ctx = createMockCtx({ confirm: mockConfirm, input: mockInput });

      const result = await handler(
        { toolName: 'edit', input: { path: 'test.ts' } },
        ctx,
      );

      expect(result).toEqual({
        block: true,
        reason: '用户拒绝了修改',
      });
    });
  });

  describe('write 工具拦截', () => {
    it('用户确认 → 不 block', async () => {
      const mockConfirm = vi.fn().mockResolvedValue(true);
      const ctx = createMockCtx({ confirm: mockConfirm });

      const result = await handler(
        { toolName: 'write', input: { path: 'output.txt' } },
        ctx,
      );

      expect(mockConfirm).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('output.txt'),
      );
      expect(result).toBeUndefined();
    });

    it('用户取消 → block', async () => {
      const mockConfirm = vi.fn().mockResolvedValue(false);
      const mockInput = vi.fn().mockResolvedValue('暂时不改');
      const ctx = createMockCtx({ confirm: mockConfirm, input: mockInput });

      const result = await handler(
        { toolName: 'write', input: { path: 'data.json' } },
        ctx,
      );

      expect(result).toEqual({
        block: true,
        reason: '用户拒绝了修改: 暂时不改',
      });
    });
  });

  // ── bash 拦截 ───────────────────────────────────

  describe('bash 工具拦截', () => {
    it('非危险命令 echo → 不拦截', async () => {
      const mockConfirm = vi.fn();
      const ctx = createMockCtx({ confirm: mockConfirm });

      const result = await handler(
        { toolName: 'bash', input: { command: 'echo hello' } },
        ctx,
      );

      expect(mockConfirm).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('非危险命令 ls -la → 不拦截', async () => {
      const mockConfirm = vi.fn();
      const ctx = createMockCtx({ confirm: mockConfirm });

      const result = await handler(
        { toolName: 'bash', input: { command: 'ls -la' } },
        ctx,
      );

      expect(mockConfirm).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('危险命令 rm -rf / → 弹确认框', async () => {
      const mockConfirm = vi.fn().mockResolvedValue(true);
      const ctx = createMockCtx({ confirm: mockConfirm });

      await handler(
        { toolName: 'bash', input: { command: 'rm -rf /' } },
        ctx,
      );

      expect(mockConfirm).toHaveBeenCalledOnce();
    });

    it('危险命令，用户确认 → 不 block', async () => {
      const mockConfirm = vi.fn().mockResolvedValue(true);
      const ctx = createMockCtx({ confirm: mockConfirm });

      const result = await handler(
        { toolName: 'bash', input: { command: 'rm -rf /tmp' } },
        ctx,
      );

      expect(result).toBeUndefined();
    });

    it('危险命令，用户取消 → 询问原因 → block', async () => {
      const mockConfirm = vi.fn().mockResolvedValue(false);
      const mockInput = vi.fn().mockResolvedValue('太危险');
      const ctx = createMockCtx({ confirm: mockConfirm, input: mockInput });

      const result = await handler(
        { toolName: 'bash', input: { command: 'rm -rf /' } },
        ctx,
      );

      expect(mockInput).toHaveBeenCalledOnce();
      expect(result).toEqual({
        block: true,
        reason: '用户拒绝了 bash 命令: 太危险',
      });
    });

    it('危险命令，用户取消且不输入原因 → 默认 reason', async () => {
      const mockConfirm = vi.fn().mockResolvedValue(false);
      const mockInput = vi.fn().mockResolvedValue('');
      const ctx = createMockCtx({ confirm: mockConfirm, input: mockInput });

      const result = await handler(
        { toolName: 'bash', input: { command: 'rm -rf /' } },
        ctx,
      );

      expect(result).toEqual({
        block: true,
        reason: '用户拒绝了 bash 命令',
      });
    });
  });

  // ── 非目标工具放行 ──────────────────────────────

  describe('非目标工具放行', () => {
    it('read 工具 → 不拦截', async () => {
      const mockConfirm = vi.fn();
      const ctx = createMockCtx({ confirm: mockConfirm });

      const result = await handler(
        { toolName: 'read', input: { path: 'file.ts' } },
        ctx,
      );

      expect(mockConfirm).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('未知工具 → 不拦截', async () => {
      const mockConfirm = vi.fn();
      const ctx = createMockCtx({ confirm: mockConfirm });

      const result = await handler(
        { toolName: 'grep', input: { pattern: 'foo' } },
        ctx,
      );

      expect(mockConfirm).not.toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  // ── isDangerousBash 规则覆盖 ─────────────────────
  // 以下测试验证所有危险命令模式都能被检测到（通过是否弹确认框间接判断）

  describe('isDangerousBash 规则覆盖', () => {
    function assertDangerous(cmd: string): void {
      it(`"${cmd}" 被判定为危险命令 → 弹确认框`, async () => {
        const mockConfirm = vi.fn().mockResolvedValue(true);
        const ctx = createMockCtx({ confirm: mockConfirm });

        await handler({ toolName: 'bash', input: { command: cmd } }, ctx);

        expect(mockConfirm).toHaveBeenCalledOnce();
      });
    }

    function assertSafe(cmd: string): void {
      it(`"${cmd}" 被判定为安全命令 → 不弹确认框`, async () => {
        const mockConfirm = vi.fn();
        const ctx = createMockCtx({ confirm: mockConfirm });

        await handler({ toolName: 'bash', input: { command: cmd } }, ctx);

        expect(mockConfirm).not.toHaveBeenCalled();
      });
    }

    assertDangerous('rm -rf /');
    assertDangerous('rm -r dir/');
    assertDangerous('rmdir some-dir');
    assertDangerous('mv file1 file2');
    assertDangerous('cp source dest');
    assertDangerous('echo hello > file.txt');
    assertDangerous('cat log | tee output.txt');
    assertDangerous('chmod +x script.sh');
    assertDangerous('dd if=/dev/zero of=file bs=1M count=10');
    assertDangerous('sudo rm -rf /');

    assertSafe('echo hello');
    assertSafe('ls -la');
    assertSafe('grep foo bar');
    assertSafe('cat file.txt');
    assertSafe('head -n 10 data.csv');
    assertSafe('git status');
  });
});
