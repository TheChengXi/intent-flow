import { describe, it, expect, vi } from 'vitest';
import { ListFolderIntentsTool } from './ListFolderIntentsTool';
import { ListFolderIntentsUseCase } from '../../../application/useCases/ListFolderIntentsUseCase';
import { IFileRepository } from '../../../data/repositories/IFileRepository';

function createMockRepo(): IFileRepository {
  return {
    readFile: vi.fn(),
    exists: vi.fn(),
    getModifiedTime: vi.fn(),
    watchFile: vi.fn(),
    unwatchFile: vi.fn(),
    getLineCount: vi.fn(),
    writeFile: vi.fn(),
    ensureDir: vi.fn(),
    scanDirectory: vi.fn(),
    deleteFile: vi.fn(),
    listSubdirectories: vi.fn(),
  };
}

describe('ListFolderIntentsTool', () => {
  it('定义正确的工具名和输入模式', () => {
    const mockRepo = createMockRepo();
    const useCase = new ListFolderIntentsUseCase(mockRepo);
    const tool = new ListFolderIntentsTool(useCase);

    expect(tool.definition.name).toBe('list_folder_intents');
    expect(tool.definition.inputSchema.properties.folder).toBeDefined();
    expect(tool.definition.inputSchema.required).toContain('folder');
  });

  it('执行后返回结构化意图清单', async () => {
    const files: Record<string, string> = {
      '/project/src/auth/login.ts': '// @intent: 用户登录',
    };
    const mockRepo = createMockRepo();
    mockRepo.scanDirectory = vi.fn().mockResolvedValue(['/project/src/auth/login.ts']);
    mockRepo.listSubdirectories = vi.fn().mockResolvedValue([]);
    mockRepo.readFile = vi.fn().mockImplementation(async (path: string) => files[path] || '');
    const useCase = new ListFolderIntentsUseCase(mockRepo);
    const tool = new ListFolderIntentsTool(useCase);

    const result = await tool.execute({ folder: '/project/src/auth' });

    expect(result.folder).toBe('/project/src/auth');
    expect(result.files).toHaveLength(1);
    expect(result.files[0].intent).toBe('用户登录');
  });
});
