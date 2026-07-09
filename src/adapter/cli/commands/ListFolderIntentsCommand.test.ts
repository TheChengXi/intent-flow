import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../CliDIContainer', () => {
  const mockUseCase = { execute: vi.fn() };
  return {
    CliDIContainer: {
      getInstance: vi.fn(() => ({
        listFolderIntentsUseCase: mockUseCase,
      })),
    },
  };
});

import { CliDIContainer } from '../CliDIContainer';
import { handler, command, description, usage } from './ListFolderIntentsCommand';

describe('ListFolderIntentsCommand', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('导出正确的命令名和描述', () => {
    expect(command).toBe('list-folder-intents');
    expect(description).toContain('意图');
    expect(usage).toContain('<folder>');
  });

  it('调用 useCase.execute 并输出结果', async () => {
    const container = vi.mocked(CliDIContainer.getInstance());
    vi.mocked(container.listFolderIntentsUseCase.execute).mockResolvedValue({
      folder: '/project/auth',
      subdirectories: [],
      files: [{ file: 'login.ts', intent: '用户登录' }],
    });

    // Capture console.log output
    const logs: string[] = [];
    vi.spyOn(console, 'log').mockImplementation((msg) => { logs.push(msg); });

    await handler(['/project/auth']);

    expect(container.listFolderIntentsUseCase.execute).toHaveBeenCalledWith('/project/auth');
    expect(logs.length).toBeGreaterThan(0);
  });

  it('缺少 folder 参数时打印错误', async () => {
    const logs: string[] = [];
    vi.spyOn(console, 'error').mockImplementation((msg) => { logs.push(msg); });
    // Prevent process.exit from stopping the test
    vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);

    await handler([]);

    expect(logs.some(l => l.includes('folder'))).toBe(true);
  });
});
