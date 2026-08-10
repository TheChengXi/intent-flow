/**
 * @intent
 * 测试 DryRunUseCase 公开接口：状态切换、拦截记录链路（统计→建记录→保存→通知）、监听器通知与失败降级。
 * 注入 FakeRepository（系统边界：文件 IO 替代）+ 真实 DryRunStatisticsService（纯计算零依赖）。
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DryRunUseCase } from './DryRunUseCase';
import type { IDryRunRepository } from '../../data/repositories/IDryRunRepository';
import { DryRunStatisticsService } from '../../data/services/DryRunStatisticsService';
import type { DryRunRecord } from '../../data/entities/DryRunRecord';

// @repository: FakeRepository
// 系统边界替身：捕获 save 入参并返回固定路径；failNext 模拟保存失败
class FakeRepository implements IDryRunRepository {
  saved: Array<{ record: DryRunRecord; outputDir: string }> = [];
  failNext = false;
  nextPath = '/fake/output/prompt-1.md';

  async save(record: DryRunRecord, outputDir: string): Promise<string> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error('save failed');
    }
    this.saved.push({ record, outputDir });
    return this.nextPath;
  }
}

describe('DryRunUseCase', () => {
  let useCase: DryRunUseCase;
  let repository: FakeRepository;

  beforeEach(() => {
    repository = new FakeRepository();
    useCase = DryRunUseCase.createDryRunUseCase(
      repository,
      new DryRunStatisticsService()
    );
  });

  it('初始状态为未启用', () => {
    expect(useCase.isEnabled()).toBe(false);
  });

  it('toggle 翻转状态并返回新状态', () => {
    expect(useCase.toggle()).toBe(true);
    expect(useCase.isEnabled()).toBe(true);
    expect(useCase.toggle()).toBe(false);
    expect(useCase.isEnabled()).toBe(false);
  });

  it('toggle 触发 onStateChange 监听器并传入新状态', () => {
    const listener = vi.fn();
    useCase.onStateChange(listener);

    useCase.toggle();
    expect(listener).toHaveBeenCalledWith(true);

    useCase.toggle();
    expect(listener).toHaveBeenCalledWith(false);
  });

  it('监听器抛错不阻断 toggle 状态翻转', () => {
    useCase.onStateChange(() => {
      throw new Error('listener error');
    });

    expect(useCase.toggle()).toBe(true);
    expect(useCase.isEnabled()).toBe(true);
  });

  it('多个 onStateChange 监听器均被触发', () => {
    const a = vi.fn();
    const b = vi.fn();
    useCase.onStateChange(a);
    useCase.onStateChange(b);

    useCase.toggle();

    expect(a).toHaveBeenCalledWith(true);
    expect(b).toHaveBeenCalledWith(true);
  });

  it('intercept 完成 统计→建记录→保存→通知 链路', async () => {
    const onIntercept = vi.fn();
    useCase.onIntercept(onIntercept);

    await useCase.intercept('compiler', 'sys prompt', 'user msg');

    expect(repository.saved).toHaveLength(1);
    const { record, outputDir } = repository.saved[0];

    expect(record.role).toBe('compiler');
    expect(record.systemPrompt).toBe('sys prompt');
    expect(record.userMessage).toBe('user msg');
    expect(record.timestamp).toBeInstanceOf(Date);

    // 统计由真实 DryRunStatisticsService 计算：fullContent = systemPrompt + \n\n + userMessage
    const fullContent = 'sys prompt\n\nuser msg';
    expect(record.statistics.totalCharacters).toBe(fullContent.length);
    expect(record.statistics.estimatedTokens).toBe(Math.ceil(fullContent.length / 4));

    // 输出目录透传自默认配置（.intentflow/test-output）
    expect(outputDir).toBe('.intentflow/test-output');

    expect(onIntercept).toHaveBeenCalledWith('/fake/output/prompt-1.md');
  });

  it('intercept 保存失败时触发 onError 降级（携带完整内容），不向上抛错', async () => {
    repository.failNext = true;
    const onError = vi.fn();
    useCase.onError(onError);

    await expect(
      useCase.intercept('compiler', 'sys', 'msg')
    ).resolves.toBeUndefined();

    expect(onError).toHaveBeenCalledTimes(1);
    const [error, content] = onError.mock.calls[0];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('save failed');
    expect(content).toContain('# System Prompt');
    expect(content).toContain('sys');
    expect(content).toContain('# User Message');
    expect(content).toContain('msg');
  });
});
