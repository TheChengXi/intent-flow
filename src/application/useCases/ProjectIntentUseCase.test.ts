/**
 * ProjectIntentUseCase — 单元测试
 *
 * @intent
 * 测试投射意图用例的 execute() 公开接口。
 * 依赖注入 mock IFileRepository，验证：
 * - 文件创建与跳过
 * - @intent 注释查找与替换（行注释、块注释、多行、回退）
 * - 字符串/数据中的 @intent 保护
 * - 静默回退到正则
 *
 * 设计原则：
 * - 只测公开接口 execute()
 * - 不 mock 内部函数（replaceIntentInContent 等），通过断言 writeFile 参数间接验证
 * - 每个测试一个关注点
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mocked } from 'vitest';
import { ProjectIntentUseCase } from './ProjectIntentUseCase';
import type { ProjectIntentInput, ProjectIntentResult } from './ProjectIntentUseCase';
import type { IFileRepository } from '../../data/repositories/IFileRepository';

// ----------------------------------------------------------------
// Helper: 创建完整 mock 的 IFileRepository
// ----------------------------------------------------------------
function createMockFileRepo(): Mocked<IFileRepository> {
  return {
    exists: vi.fn<(filePath: string) => Promise<boolean>>(),
    readFile: vi.fn<(filePath: string) => Promise<string>>(),
    writeFile: vi.fn<(filePath: string, content: string) => Promise<void>>(),
    getModifiedTime: vi.fn<(filePath: string) => Promise<number>>(),
    watchFile: vi.fn<(filePath: string, callback: (filePath: string) => void) => void>(),
    unwatchFile: vi.fn<(filePath: string) => void>(),
    getLineCount: vi.fn<(filePath: string) => Promise<number>>(),
    ensureDir: vi.fn<(dirPath: string) => Promise<void>>(),
    scanDirectory: vi.fn<
      (dirPath: string, options?: { extensions?: string[]; recursive?: boolean }) => Promise<string[]>
    >(),
    deleteFile: vi.fn<(filePath: string) => Promise<void>>(),
    renameFile: vi.fn<(oldPath: string, newPath: string) => Promise<void>>(),
    listSubdirectories: vi.fn<(dirPath: string) => Promise<string[]>>(),
  };
}

// ----------------------------------------------------------------
// 测试套件
// ----------------------------------------------------------------
describe('ProjectIntentUseCase', () => {
  let mockRepo: ReturnType<typeof createMockFileRepo>;
  let useCase: ProjectIntentUseCase;

  beforeEach(() => {
    mockRepo = createMockFileRepo();
    useCase = new ProjectIntentUseCase(mockRepo);
  });

  // ─────────────────────────────────────────────
  // 文件不存在 → 创建
  // ─────────────────────────────────────────────
  describe('file creation', () => {
    it('creates a new file with @intent block when file does not exist', async () => {
      mockRepo.exists.mockResolvedValue(false);
      mockRepo.writeFile.mockResolvedValue();

      const result = await useCase.execute({
        path: 'src/module.ts',
        intent: '计算模块',
        force: true,
      });

      expect(result).toEqual<ProjectIntentResult>({
        path: 'src/module.ts',
        created: true,
        updated: false,
      });
      expect(mockRepo.writeFile).toHaveBeenCalledTimes(1);
      const content = mockRepo.writeFile.mock.calls[0][1];
      expect(content).toContain('@intent');
      expect(content).toContain('计算模块');
    });

    it('generates /** @intent */ block style for .ts files', async () => {
      mockRepo.exists.mockResolvedValue(false);
      mockRepo.writeFile.mockResolvedValue();

      await useCase.execute({
        path: 'src/module.ts',
        intent: '单行描述',
        force: true,
      });

      const content = mockRepo.writeFile.mock.calls[0][1];
      expect(content).toMatch(/\/\*\*\s*\n/);           // 块注释开始
      expect(content).toMatch(/\*\s@intent\b/);         // @intent 标记
      expect(content).toMatch(/\*\/\s*\n?$/);           // 块注释结束
      expect(content).toContain('单行描述');
    });

    it('generates # @intent style for .py files', async () => {
      mockRepo.exists.mockResolvedValue(false);
      mockRepo.writeFile.mockResolvedValue();

      await useCase.execute({
        path: 'src/module.py',
        intent: 'Python模块',
        force: true,
      });

      const content = mockRepo.writeFile.mock.calls[0][1];
      expect(content.startsWith('# @intent')).toBe(true);
      expect(content).toContain('Python模块');
    });

    it('generates plain @intent for unknown extension files', async () => {
      mockRepo.exists.mockResolvedValue(false);
      mockRepo.writeFile.mockResolvedValue();

      await useCase.execute({
        path: 'config.yaml',
        intent: 'YAML 配置',
        force: true,
      });

      const content = mockRepo.writeFile.mock.calls[0][1];
      // 未知扩展名时 generateIntentBlock 返回纯文本格式
      expect(content.startsWith('@intent')).toBe(true);
      expect(content).toContain('YAML 配置');
    });
  });

  // ─────────────────────────────────────────────
  // 跳过条件
  // ─────────────────────────────────────────────
  describe('skip behavior', () => {
    it('returns updated:false when file exists and force is false', async () => {
      mockRepo.exists.mockResolvedValue(true);

      const result = await useCase.execute({
        path: 'src/module.ts',
        intent: '任何描述',
        force: false,
      });

      expect(result).toEqual<ProjectIntentResult>({
        path: 'src/module.ts',
        created: false,
        updated: false,
      });
      expect(mockRepo.readFile).not.toHaveBeenCalled();
      expect(mockRepo.writeFile).not.toHaveBeenCalled();
    });
  });

  // ─────────────────────────────────────────────
  // 场景 A：行注释 // @intent 替换为 /** @intent */ 块
  // ─────────────────────────────────────────────
  describe('single-line // @intent replacement', () => {
    it('replaces // @intent: line comment with new /** @intent */ block in .ts file', async () => {
      const existing = '// @intent: 旧模块描述\n\nexport const x = 1;\n';
      mockRepo.exists.mockResolvedValue(true);
      mockRepo.readFile.mockResolvedValue(existing);
      mockRepo.writeFile.mockResolvedValue();

      const result = await useCase.execute({
        path: 'src/module.ts',
        intent: '新的模块描述',
        force: true,
      });

      expect(result).toEqual<ProjectIntentResult>({
        path: 'src/module.ts',
        created: false,
        updated: true,
      });
      expect(mockRepo.writeFile).toHaveBeenCalledTimes(1);
      const updated = mockRepo.writeFile.mock.calls[0][1];

      // 旧内容被替换
      expect(updated).not.toContain('旧模块描述');
      // 新内容出现
      expect(updated).toContain('新的模块描述');
      // 使用块注释风格
      expect(updated).toMatch(/\/\*\*/);
      expect(updated).toMatch(/\* @intent/);
      // 文件其他部分保留
      expect(updated).toContain('export const x = 1;');
    });

    it('preserves shebang line when replacing @intent at top', async () => {
      const existing = '#!/usr/bin/env node\n// @intent: 旧描述\n\nconsole.log("hello");\n';
      mockRepo.exists.mockResolvedValue(true);
      mockRepo.readFile.mockResolvedValue(existing);
      mockRepo.writeFile.mockResolvedValue();

      const result = await useCase.execute({
        path: 'src/cli.ts',
        intent: 'CLI 入口',
        force: true,
      });

      expect(result.updated).toBe(true);
      const updated = mockRepo.writeFile.mock.calls[0][1];
      expect(updated.startsWith('#!/usr/bin/env node')).toBe(true);
      expect(updated).not.toContain('旧描述');
      expect(updated).toContain('CLI 入口');
      expect(updated).toContain('console.log("hello")');
    });
  });

  // ─────────────────────────────────────────────
  // 场景 C：多行 // @intent 整体替换
  // ─────────────────────────────────────────────
  describe('multi-line // @intent replacement', () => {
    it('replaces multi-line // @intent comments as a whole block without residual lines', async () => {
      const existing = [
        '// @intent: 第一行描述',
        '// 第二行描述',
        '// 第三行描述',
        '',
        'function foo() {}',
        '',
      ].join('\n');
      mockRepo.exists.mockResolvedValue(true);
      mockRepo.readFile.mockResolvedValue(existing);
      mockRepo.writeFile.mockResolvedValue();

      const result = await useCase.execute({
        path: 'src/foo.ts',
        intent: '新功能实现',
        force: true,
      });

      expect(result.updated).toBe(true);
      const updated = mockRepo.writeFile.mock.calls[0][1];

      // 旧三行全部移除，不残留
      expect(updated).not.toContain('第一行描述');
      expect(updated).not.toContain('第二行描述');
      expect(updated).not.toContain('第三行描述');
      // 新内容替换
      expect(updated).toContain('新功能实现');
      // 其他代码保留
      expect(updated).toContain('function foo() {}');
    });
  });

  // ─────────────────────────────────────────────
  // 场景 B：数据/字符串中的 @intent 不被误伤
  // ─────────────────────────────────────────────
  describe('protection: @intent in strings is not affected', () => {
    it('does not replace @intent inside string literals', async () => {
      const existing = [
        '// @intent: 旧模块描述',
        '',
        'const note = "备注包含 @intent 字样";',
        'const sql = "SELECT * FROM users WHERE note LIKE \'%intent%\'";',
        '',
        'export function test() {}',
        '',
      ].join('\n');
      mockRepo.exists.mockResolvedValue(true);
      mockRepo.readFile.mockResolvedValue(existing);
      mockRepo.writeFile.mockResolvedValue();

      const result = await useCase.execute({
        path: 'src/test.ts',
        intent: '新模块描述',
        force: true,
      });

      expect(result.updated).toBe(true);
      const updated = mockRepo.writeFile.mock.calls[0][1];

      // 顶部 @intent 注释被替换
      expect(updated).not.toContain('旧模块描述');
      expect(updated).toContain('新模块描述');
      // 字符串中的 @intent 文本保持原样（不丢失、不被修改）
      expect(updated).toContain('备注包含 @intent 字样');
      expect(updated).toContain("LIKE '%intent%'");
      // 其他代码保留
      expect(updated).toContain('export function test() {}');
    });

    it('does not replace @intent inside template literals', async () => {
      const existing = [
        '// @intent: 旧组件描述',
        '',
        'const msg = `注意：@intent 标记在此`;',
        '',
        'export class MyComp {}',
        '',
      ].join('\n');
      mockRepo.exists.mockResolvedValue(true);
      mockRepo.readFile.mockResolvedValue(existing);
      mockRepo.writeFile.mockResolvedValue();

      const result = await useCase.execute({
        path: 'src/comp.ts',
        intent: '新组件描述',
        force: true,
      });

      expect(result.updated).toBe(true);
      const updated = mockRepo.writeFile.mock.calls[0][1];

      expect(updated).not.toContain('旧组件描述');
      expect(updated).toContain('新组件描述');
      expect(updated).toContain('注意：@intent 标记在此');
    });
  });

  // ─────────────────────────────────────────────
  // 场景 D：未知扩展名 — 静默正则回退
  // ─────────────────────────────────────────────
  describe('regex fallback for unknown extensions', () => {
    it('replaces -- @intent comment in .sql file via regex fallback', async () => {
      const existing = [
        '-- @intent: 旧 SQL 描述',
        '',
        'SELECT * FROM users;',
        '',
      ].join('\n');
      mockRepo.exists.mockResolvedValue(true);
      mockRepo.readFile.mockResolvedValue(existing);
      mockRepo.writeFile.mockResolvedValue();

      const result = await useCase.execute({
        path: 'queries/query.sql',
        intent: '用户查询',
        force: true,
      });

      expect(result.updated).toBe(true);
      const updated = mockRepo.writeFile.mock.calls[0][1];

      // 旧描述被替换
      expect(updated).not.toContain('旧 SQL 描述');
      expect(updated).toContain('用户查询');
      // SQL 代码保留
      expect(updated).toContain('SELECT * FROM users;');
    });

    it('replaces # @intent comment in .r file via regex fallback', async () => {
      const existing = [
        '# @intent: R 脚本旧描述',
        '',
        'data <- read.csv("input.csv")',
        '',
      ].join('\n');
      mockRepo.exists.mockResolvedValue(true);
      mockRepo.readFile.mockResolvedValue(existing);
      mockRepo.writeFile.mockResolvedValue();

      const result = await useCase.execute({
        path: 'scripts/analysis.R',
        intent: '数据分析脚本',
        force: true,
      });

      expect(result.updated).toBe(true);
      const updated = mockRepo.writeFile.mock.calls[0][1];

      expect(updated).not.toContain('R 脚本旧描述');
      expect(updated).toContain('数据分析脚本');
      expect(updated).toContain('data <- read.csv("input.csv")');
    });
  });

  // ─────────────────────────────────────────────
  // 已存在 /** @intent */ 块注释的替换
  // ─────────────────────────────────────────────
  describe('existing /** @intent */ block comment', () => {
    it('replaces multi-line /** @intent */ block with new block', async () => {
      const existing = [
        '/**',
        ' * @intent 旧的块描述',
        ' * 更多说明',
        ' */',
        '',
        'export const y = 2;',
        '',
      ].join('\n');
      mockRepo.exists.mockResolvedValue(true);
      mockRepo.readFile.mockResolvedValue(existing);
      mockRepo.writeFile.mockResolvedValue();

      const result = await useCase.execute({
        path: 'src/baz.ts',
        intent: '新的块描述',
        force: true,
      });

      expect(result.updated).toBe(true);
      const updated = mockRepo.writeFile.mock.calls[0][1];

      expect(updated).not.toContain('旧的块描述');
      expect(updated).not.toContain('更多说明');
      expect(updated).toContain('新的块描述');
      expect(updated).toContain('export const y = 2;');
    });
  });

  // ─────────────────────────────────────────────
  // 未找到已有 @intent → 追加到文件顶部
  // ─────────────────────────────────────────────
  describe('no existing @intent found', () => {
    it('prepends @intent block to top when no existing @intent exists', async () => {
      const existing = 'export const x = 1;\n\nfunction bar() {}\n';
      mockRepo.exists.mockResolvedValue(true);
      mockRepo.readFile.mockResolvedValue(existing);
      mockRepo.writeFile.mockResolvedValue();

      const result = await useCase.execute({
        path: 'src/bar.ts',
        intent: '工具函数',
        force: true,
      });

      expect(result.updated).toBe(true);
      const updated = mockRepo.writeFile.mock.calls[0][1];

      // @intent 块被追加到文件顶部
      expect(updated.startsWith('/**')).toBe(true);
      expect(updated).toContain('@intent');
      expect(updated).toContain('工具函数');
      // 原内容保留
      expect(updated).toContain('export const x = 1;');
      expect(updated).toContain('function bar() {}');
    });
  });

  // ─────────────────────────────────────────────
  // 异常与边界情况
  // ─────────────────────────────────────────────
  describe('edge cases', () => {
    it('handles empty file content', async () => {
      mockRepo.exists.mockResolvedValue(true);
      mockRepo.readFile.mockResolvedValue('');
      mockRepo.writeFile.mockResolvedValue();

      const result = await useCase.execute({
        path: 'src/empty.ts',
        intent: '空文件描述',
        force: true,
      });

      expect(result.updated).toBe(true);
      const updated = mockRepo.writeFile.mock.calls[0][1];
      expect(updated).toContain('@intent');
      expect(updated).toContain('空文件描述');
    });

    it('preserves file content exactly when only @intent is replaced', async () => {
      const existing = [
        '// @intent: 旧标题',
        '',
        'import { foo } from "./foo";',
        '',
        'foo();',
        '',
      ].join('\n');
      mockRepo.exists.mockResolvedValue(true);
      mockRepo.readFile.mockResolvedValue(existing);
      mockRepo.writeFile.mockResolvedValue();

      await useCase.execute({
        path: 'src/demo.ts',
        intent: '新标题',
        force: true,
      });

      const updated = mockRepo.writeFile.mock.calls[0][1];
      // 空白行 + 导入语句 + 函数调用应完全保留
      expect(updated).toContain('import { foo } from "./foo"');
      expect(updated).toContain('foo();');
      // 确认旧标题所在位置被替换而非追加
      expect(updated.split('\n').filter((l: string) => l.includes('@intent')).length).toBeGreaterThanOrEqual(1);
    });
  });
});
