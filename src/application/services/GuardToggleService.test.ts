/**
 * GuardToggleService 单元测试
 *
 * 大部分场景使用真实 GuardToggleStore + process.chdir(mkdtemp) 隔离（同
 * src/data/services/guard/GuardToggleStore.test.ts 模式）；写失败场景注入
 * 一个 write 抛错的 fake store（TS 结构类型，实现 read/write 签名即可）。
 * 不 mock 被测类 GuardToggleService 本身。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GuardToggleService } from './GuardToggleService';
import { GuardToggleStore } from '../../data/services/guard/GuardToggleStore';

/**
 * 构造 fake store：实现 GuardToggleStore 的公开签名 read()/write()。
 * 因 GuardToggleStore 含 private 成员（configPath），纯结构对象需经
 * unknown 桥接才能赋值给 GuardToggleStore 类型。
 * 返回 writes 记录 write() 被调用的参数（仅默认 write 记录）。
 */
function createFakeStore(options: {
  read?: () => boolean;
  write?: (enabled: boolean) => Promise<void>;
} = {}): { store: GuardToggleStore; writes: boolean[] } {
  const writes: boolean[] = [];
  const store = {
    read: options.read ?? (() => true),
    write:
      options.write ??
      (async (enabled: boolean): Promise<void> => {
        writes.push(enabled);
      }),
  } as unknown as GuardToggleStore;
  return { store, writes };
}

describe('GuardToggleService', () => {
  const ORIGINAL_CWD = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'guard-toggle-service-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(ORIGINAL_CWD);
    rmSync(tempDir, { recursive: true, force: true });
  });

  // ==================== 构造：经 store.read() 同步加载初始状态 ====================

  it.each([
    [true, true],
    [false, false],
  ])(
    '构造后 isEnabled() 反映 store 持久化状态（read()=%s → isEnabled()=%s）',
    async (persisted, expected) => {
      const store = new GuardToggleStore();
      await store.write(persisted);

      const service = new GuardToggleService(store);
      expect(service.isEnabled()).toBe(expected);
    },
  );

  it('构造时同步调用 store.read() 加载状态（fake read 返回 false → isEnabled() false）', () => {
    const { store } = createFakeStore({ read: () => false });
    expect(new GuardToggleService(store).isEnabled()).toBe(false);
  });

  // ==================== toggle()：翻转内存并写回，返回新状态 ====================

  it('toggle() 翻转内存状态、写回 store，并返回新状态', async () => {
    const { store, writes } = createFakeStore({ read: () => true });
    const service = new GuardToggleService(store);

    expect(await service.toggle()).toBe(false);
    expect(service.isEnabled()).toBe(false);
    expect(writes).toEqual([false]);

    expect(await service.toggle()).toBe(true);
    expect(service.isEnabled()).toBe(true);
    expect(writes).toEqual([false, true]);
  });

  it('连续 toggle() true→false→true 翻转正确，且落盘状态一致', async () => {
    const store = new GuardToggleStore();
    await store.write(true);
    const service = new GuardToggleService(store);
    expect(service.isEnabled()).toBe(true);

    expect(await service.toggle()).toBe(false);
    expect(await service.toggle()).toBe(true);
    expect(await service.toggle()).toBe(false);

    expect(new GuardToggleStore().read()).toBe(false);
  });

  // ==================== toggle() 写失败：抛错但内存已翻转 ====================

  it('toggle() 写失败时抛错，且 isEnabled() 已为新值', async () => {
    const { store } = createFakeStore({
      read: () => true,
      write: async () => {
        throw new Error('write failed');
      },
    });
    const service = new GuardToggleService(store);
    expect(service.isEnabled()).toBe(true);

    await expect(service.toggle()).rejects.toThrow('write failed');
    expect(service.isEnabled()).toBe(false);
  });

  it('toggle() 写失败后再次 toggle 仍基于已翻转的内存状态', async () => {
    const { store } = createFakeStore({
      read: () => true,
      write: async () => {
        throw new Error('write failed');
      },
    });
    const service = new GuardToggleService(store);

    await expect(service.toggle()).rejects.toThrow();
    expect(service.isEnabled()).toBe(false);

    await expect(service.toggle()).rejects.toThrow();
    expect(service.isEnabled()).toBe(true);
  });

  // ==================== isEnabled()：同步且不抛异常 ====================

  it('isEnabled() 为同步调用且不抛异常', () => {
    const service = new GuardToggleService(new GuardToggleStore());
    expect(() => {
      expect(typeof service.isEnabled()).toBe('boolean');
      expect(service.isEnabled()).toBe(true);
      expect(service.isEnabled()).toBe(true);
    }).not.toThrow();
  });

  // ==================== 边界：本类不做二次兜底 ====================

  it('构造时 store.read() 抛错向上传播（本类不做二次兜底）', () => {
    const { store } = createFakeStore({
      read: () => {
        throw new Error('read failed');
      },
    });
    expect(() => new GuardToggleService(store)).toThrow('read failed');
  });
});
