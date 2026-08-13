/**
 * @intent
 * GuardToggleStore 单元测试：不 mock 被测类，用真实文件系统 + chdir 临时目录验证 .intentflow/guard-state.json 的读写行为。
 * 验收条件：
 * - 覆盖默认值、持久化、异常清理路径
 */

/**
 * GuardToggleStore 单元测试
 *
 * 不 mock 被测类，使用真实文件系统验证 .intentflow/guard-state.json 的读写行为。
 * 测试通过 process.chdir() 切换到 mkdtemp 临时目录隔离 cwd，
 * afterEach 恢复原 cwd 并清理临时目录。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  mkdtempSync,
  rmSync,
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GuardToggleStore } from './GuardToggleStore';

describe('GuardToggleStore', () => {
  const ORIGINAL_CWD = process.cwd();
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'guard-toggle-store-'));
    process.chdir(tempDir);
  });

  afterEach(() => {
    process.chdir(ORIGINAL_CWD);
    rmSync(tempDir, { recursive: true, force: true });
  });

  /** 当前 cwd 下配置文件的固定路径 */
  const configPath = (): string => join(process.cwd(), '.intentflow', 'guard-state.json');

  /** 直接向配置文件路径写入指定内容（绕过被测类，用于构造边界场景） */
  const seedConfig = (content: string): void => {
    mkdirSync(join(process.cwd(), '.intentflow'), { recursive: true });
    writeFileSync(configPath(), content, 'utf-8');
  };

  // ==================== read() 边界：默认安全态 ====================

  it('配置文件不存在时 read() 返回 true 且不抛异常', () => {
    const store = new GuardToggleStore();
    expect(existsSync(configPath())).toBe(false);
    expect(store.read()).toBe(true);
  });

  it('配置文件内容为损坏 JSON 时 read() 返回 true 且不抛异常', () => {
    seedConfig('{ not valid json !!');
    const store = new GuardToggleStore();
    expect(store.read()).toBe(true);
  });

  it('enabled 字段缺失时 read() 返回 true 且不抛异常', () => {
    seedConfig('{}');
    const store = new GuardToggleStore();
    expect(store.read()).toBe(true);
  });

  it.each([
    ['字符串', '{ "enabled": "yes" }'],
    ['数字', '{ "enabled": 1 }'],
    ['null', '{ "enabled": null }'],
    ['数组', '{ "enabled": [] }'],
  ])('enabled 字段类型非法（%s）时 read() 返回 true 且不抛异常', (_label, content) => {
    seedConfig(content);
    const store = new GuardToggleStore();
    expect(store.read()).toBe(true);
  });

  // ==================== write() → read() 回环 ====================

  it('write(true) 后 read() 返回 true', async () => {
    const store = new GuardToggleStore();
    await store.write(true);
    expect(store.read()).toBe(true);
  });

  it('write(false) 后 read() 返回 false', async () => {
    const store = new GuardToggleStore();
    await store.write(false);
    expect(store.read()).toBe(false);
  });

  it('write 持久化后新实例 read() 读到相同状态', async () => {
    const store = new GuardToggleStore();
    await store.write(false);
    expect(new GuardToggleStore().read()).toBe(false);

    await store.write(true);
    expect(new GuardToggleStore().read()).toBe(true);
  });

  it('write 覆盖旧文件：write(true) 后再 write(false) 读到 false', async () => {
    const store = new GuardToggleStore();
    await store.write(true);
    await store.write(false);
    expect(store.read()).toBe(false);
  });

  // ==================== 文件落盘位置 ====================

  it('配置文件固定落盘在 <process.cwd()>/.intentflow/guard-state.json', async () => {
    const store = new GuardToggleStore();
    await store.write(false);

    expect(existsSync(configPath())).toBe(true);
    expect(JSON.parse(readFileSync(configPath(), 'utf-8'))).toEqual({ enabled: false });
  });

  it('read() 读取的是 .intentflow/guard-state.json 中持久化的 enabled 值', () => {
    seedConfig('{ "enabled": false }');
    expect(new GuardToggleStore().read()).toBe(false);

    seedConfig('{ "enabled": true }');
    expect(new GuardToggleStore().read()).toBe(true);
  });
});
