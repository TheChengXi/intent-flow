/**
 * @intent
 * 测试 CheckFileSizeUseCase 的新行为：
 * - 构造函数注入 fileRepo + parserRepo
 * - fileRepo.readFile() → parserRepo.countNonCommentLines() 获取纯代码行数
 * - 未超标时不输出 needsRefactor，超标时输出 needsRefactor: true
 * - 输入已移除 workspaceRoot，输出已移除 lineCount
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CheckFileSizeUseCase } from './CheckFileSizeUseCase';
import type { IFileRepository } from '../../data/repositories/IFileRepository';
import type { ICodeParserRepository } from '../../data/repositories/ICodeParserRepository';

// ==================== mock 工具 ====================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MockFn = ReturnType<typeof vi.fn>;

function createMockFileRepo() {
  return {
    exists: vi.fn() as MockFn,
    readFile: vi.fn() as MockFn,
    getLineCount: vi.fn() as MockFn,
    getModifiedTime: vi.fn() as MockFn,
    watchFile: vi.fn() as MockFn,
    unwatchFile: vi.fn() as MockFn,
    writeFile: vi.fn() as MockFn,
    ensureDir: vi.fn() as MockFn,
    scanDirectory: vi.fn() as MockFn,
    deleteFile: vi.fn() as MockFn,
    listSubdirectories: vi.fn() as MockFn,
  };
}

function createMockParserRepo() {
  return {
    parse: vi.fn() as MockFn,
    countNonCommentLines: vi.fn() as MockFn,
    searchFunctionDefinition: vi.fn() as MockFn,
    searchTypeDefinition: vi.fn() as MockFn,
    extractFunctionCalls: vi.fn() as MockFn,
    extractTypeReferences: vi.fn() as MockFn,
    extractImports: vi.fn() as MockFn,
    searchContract: vi.fn() as MockFn,
  };
}

// ==================== 测试 ====================

describe('CheckFileSizeUseCase', () => {
  let fileRepo: ReturnType<typeof createMockFileRepo>;
  let parserRepo: ReturnType<typeof createMockParserRepo>;
  let useCase: CheckFileSizeUseCase;

  beforeEach(() => {
    vi.clearAllMocks();
    fileRepo = createMockFileRepo();
    parserRepo = createMockParserRepo();
    useCase = new CheckFileSizeUseCase(fileRepo as unknown as IFileRepository, parserRepo as unknown as ICodeParserRepository);

    // 默认开心路径：文件存在且有内容
    fileRepo.exists.mockResolvedValue(true);
    fileRepo.readFile.mockResolvedValue('line1\nline2\nline3\n');
    parserRepo.countNonCommentLines.mockResolvedValue(380);
  });

  // ── 场景 1：未超标 ─────────────────────────────

  it('未超标（380 < 400）时返回 exceedLines: 0，无 needsRefactor', async () => {
    parserRepo.countNonCommentLines.mockResolvedValue(380);

    const result = await useCase.execute({
      filePath: '/path/to/file.ts',
    });

    expect(result).toEqual([
      {
        filePath: '/path/to/file.ts',
        exceedLines: 0,
      },
    ]);
    // needsRefactor 不应出现在结果中
    expect(result[0]).not.toHaveProperty('needsRefactor');
  });

  // ── 场景 2：超标 ─────────────────────────────

  it('超标（520 > 400）时返回 exceedLines: 120 且 needsRefactor: true', async () => {
    parserRepo.countNonCommentLines.mockResolvedValue(520);

    const result = await useCase.execute({
      filePath: '/path/to/file.ts',
    });

    expect(result).toEqual([
      {
        filePath: '/path/to/file.ts',
        exceedLines: 120,
        needsRefactor: true,
      },
    ]);
  });

  // ── 场景 3：自定义 threshold ─────────────────────

  it('自定义 threshold 按自定义值判断（300 > 200）', async () => {
    parserRepo.countNonCommentLines.mockResolvedValue(300);

    const result = await useCase.execute({
      filePath: '/path/to/file.ts',
      threshold: 200,
    });

    expect(result).toEqual([
      {
        filePath: '/path/to/file.ts',
        exceedLines: 100,
        needsRefactor: true,
      },
    ]);
  });

  it('自定义 threshold 下未超标（150 < 200）', async () => {
    parserRepo.countNonCommentLines.mockResolvedValue(150);

    const result = await useCase.execute({
      filePath: '/path/to/file.ts',
      threshold: 200,
    });

    expect(result).toEqual([
      {
        filePath: '/path/to/file.ts',
        exceedLines: 0,
      },
    ]);
    expect(result[0]).not.toHaveProperty('needsRefactor');
  });

  // ── 场景 4：文件不存在 ────────────────────────

  it('文件不存在时抛出错误', async () => {
    fileRepo.exists.mockResolvedValue(false);

    await expect(
      useCase.execute({ filePath: '/path/to/missing.ts' })
    ).rejects.toThrow(/file.*not found|not found|File.*exists/i);
  });

  // ── 场景 5：空文件 ─────────────────────────────

  it('空文件返回 exceedLines: 0', async () => {
    fileRepo.readFile.mockResolvedValue('');
    parserRepo.countNonCommentLines.mockResolvedValue(0);

    const result = await useCase.execute({
      filePath: '/path/to/empty.ts',
    });

    expect(result).toEqual([
      {
        filePath: '/path/to/empty.ts',
        exceedLines: 0,
      },
    ]);
    expect(result[0]).not.toHaveProperty('needsRefactor');
  });

  // ── 场景 6：边界：刚好等于 threshold ────────────

  it('纯代码行数等于 threshold（400 === 400）不超标', async () => {
    parserRepo.countNonCommentLines.mockResolvedValue(400);

    const result = await useCase.execute({
      filePath: '/path/to/file.ts',
    });

    expect(result).toEqual([
      {
        filePath: '/path/to/file.ts',
        exceedLines: 0,
      },
    ]);
    expect(result[0]).not.toHaveProperty('needsRefactor');
  });

  // ── 场景 7：验证调用链 ─────────────────────────

  it('正确调用 fileRepo.readFile 和 parserRepo.countNonCommentLines', async () => {
    fileRepo.readFile.mockResolvedValue('some content');
    parserRepo.countNonCommentLines.mockResolvedValue(100);

    await useCase.execute({ filePath: '/path/to/file.ts' });

    // 验证调用顺序：先读文件，再统计行数
    expect(fileRepo.readFile).toHaveBeenCalledWith('/path/to/file.ts');
    expect(parserRepo.countNonCommentLines).toHaveBeenCalledWith(
      'some content',
      '/path/to/file.ts'
    );
  });

  // ── 场景 8：验证 fileRepo.exists 被调用 ─────────

  it('先检查文件是否存在', async () => {
    fileRepo.exists.mockResolvedValue(true);
    fileRepo.readFile.mockResolvedValue('content');
    parserRepo.countNonCommentLines.mockResolvedValue(100);

    await useCase.execute({ filePath: '/path/to/file.ts' });

    expect(fileRepo.exists).toHaveBeenCalledWith('/path/to/file.ts');
  });
});
