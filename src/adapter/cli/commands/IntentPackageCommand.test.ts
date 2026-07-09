import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handler, command, description, usage } from './IntentPackageCommand';

// 模拟依赖——IntentPackageCommand 内部会通过 CliDIContainer 获取依赖
// 我们直接在测试前 mock CliDIContainer
vi.mock('../CliDIContainer', () => {
  const mockMaintain = { execute: vi.fn() };
  const mockQuery = {
    getPackage: vi.fn(),
    listPackages: vi.fn(),
    searchPackages: vi.fn(),
  };
  return {
    CliDIContainer: {
      getInstance: vi.fn(() => ({
        maintainIntentPackagesUseCase: mockMaintain,
        intentPackageQueryService: mockQuery,
      })),
    },
  };
});

import { CliDIContainer } from '../CliDIContainer';

describe('IntentPackageCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('导出正确的命令名和描述', () => {
    expect(command).toBe('intent-package');
    expect(description).toContain('意图包');
    expect(usage).toContain('update');
    expect(usage).toContain('list');
    expect(usage).toContain('get');
    expect(usage).toContain('search');
  });

  it('get 子命令调用 queryService.getPackage', async () => {
    const container = vi.mocked(CliDIContainer.getInstance());
    vi.mocked(container.intentPackageQueryService.getPackage).mockResolvedValue({
      packageName: 'auth', summary: '认证', groups: [], crossRefs: [],
    });

    await handler(['get', 'auth']);

    expect(container.intentPackageQueryService.getPackage).toHaveBeenCalledWith('auth');
  });

  it('list 子命令调用 queryService.listPackages', async () => {
    const container = vi.mocked(CliDIContainer.getInstance());
    vi.mocked(container.intentPackageQueryService.listPackages).mockResolvedValue(['auth', 'notif']);

    await handler(['list']);

    expect(container.intentPackageQueryService.listPackages).toHaveBeenCalled();
  });

  it('update 子命令调用 maintainUseCase.execute', async () => {
    const container = vi.mocked(CliDIContainer.getInstance());
    vi.mocked(container.maintainIntentPackagesUseCase.execute).mockResolvedValue({
      action: 'updated', packageName: 'auth', message: 'ok',
    });

    await handler(['update', '/project/auth']);

    expect(container.maintainIntentPackagesUseCase.execute).toHaveBeenCalledWith({
      folderPath: '/project/auth',
    });
  });

  it('未知子命令不抛错', async () => {
    await expect(handler(['unknown'])).resolves.not.toThrow();
  });
});
