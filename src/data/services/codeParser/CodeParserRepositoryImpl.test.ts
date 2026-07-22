/**
 * @intent
 * 测试 CodeParserRepositoryImpl.countNonCommentLines。
 * mock TreeSitterManager 避免加载真实 wasm，通过构造模拟 AST 节点验证注释行排除逻辑。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ==================== mock TreeSitterManager ====================

vi.mock('../tree-sitter/TreeSitterManager', () => ({
  TreeSitterManager: {
    init: vi.fn(),
    getLanguage: vi.fn(),
    getParser: vi.fn(),
    clearCache: vi.fn(),
  },
}));

import { CodeParserRepositoryImpl } from './CodeParserRepositoryImpl';
import { TreeSitterManager } from '../tree-sitter/TreeSitterManager';

// ==================== mock AST 构造工具 ====================

interface MockPosition {
  row: number;
  column: number;
}

interface MockNode {
  type: string;
  startPosition: MockPosition;
  endPosition: MockPosition;
  children: MockNode[];
}

/**
 * 创建一个模拟的 SyntaxNode
 */
function node(type: string, startRow: number, endRow: number, children: MockNode[] = []): MockNode {
  return {
    type,
    startPosition: { row: startRow, column: 0 },
    endPosition: { row: endRow, column: 0 },
    children,
  };
}

/**
 * 创建一个模拟的 Tree（parser.parse 的返回值）
 */
function tree(rootChildren: MockNode[]): { rootNode: MockNode } {
  const lastRow = rootChildren.length > 0
    ? Math.max(...rootChildren.map(c => c.endPosition.row))
    : 0;
  return {
    rootNode: node('program', 0, lastRow, rootChildren),
  };
}

/**
 * 设置 mock parser 的默认行为
 */
function setupMockParser(mockTree: { rootNode: MockNode }): void {
  const mockParser = {
    setLanguage: vi.fn(),
    parse: vi.fn().mockReturnValue(mockTree),
  };
  (TreeSitterManager.getParser as any as ReturnType<typeof vi.fn>).mockResolvedValue(mockParser);
}

// ==================== 测试 ====================

describe('CodeParserRepositoryImpl.countNonCommentLines', () => {
  let repo: CodeParserRepositoryImpl;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new CodeParserRepositoryImpl();

    // 默认 mock：init 成功
    (TreeSitterManager.init as any as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  // ── 场景 1：纯代码（无注释）────────────────────────────

  it('纯代码（无注释）返回总行数', async () => {
    const mockTree = tree([
      node('expression_statement', 0, 0),
      node('expression_statement', 1, 1),
      node('expression_statement', 2, 2),
    ]);
    setupMockParser(mockTree);
    (TreeSitterManager.getLanguage as any as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await repo.countNonCommentLines(
      'const a = 1;\nconst b = 2;\nconst c = 3;\n',
      '/path/to/file.ts',
    );

    expect(result).toBe(3);
  });

  // ── 场景 2：单行注释 // ──────────────────────────────────

  it('排除单行注释 //', async () => {
    const mockTree = tree([
      node('expression_statement', 0, 0),
      node('comment', 1, 1),
      node('expression_statement', 2, 2),
    ]);
    setupMockParser(mockTree);
    (TreeSitterManager.getLanguage as any as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await repo.countNonCommentLines(
      'const a = 1;\n// this is a comment\nconst b = 2;\n',
      '/path/to/file.ts',
    );

    expect(result).toBe(2);
  });

  // ── 场景 3：多行注释 /* */ ────────────────────────────────

  it('排除多行注释 /* */', async () => {
    const mockTree = tree([
      node('expression_statement', 0, 0),
      node('comment', 1, 3),       // 多行注释占 3 行
      node('expression_statement', 4, 4),
    ]);
    setupMockParser(mockTree);
    (TreeSitterManager.getLanguage as any as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await repo.countNonCommentLines(
      'const a = 1;\n/*\nmulti\nline\n*/\nconst b = 2;\n',
      '/path/to/file.ts',
    );

    expect(result).toBe(2);
  });

  // ── 场景 4：行内注释（代码后有 //）────────────────────────

  it('行内注释（代码后有 //）不排除该行', async () => {
    // 同一行（row 0）既有 expression_statement 又有 comment
    const mockTree = tree([
      node('expression_statement', 0, 0),
      node('comment', 0, 0),       // 与 expression_statement 共享行 0
      node('expression_statement', 1, 1),
    ]);
    setupMockParser(mockTree);
    (TreeSitterManager.getLanguage as any as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await repo.countNonCommentLines(
      'const a = 1; // inline comment\nconst b = 2;\n',
      '/path/to/file.ts',
    );

    // 行 0 有代码，不应被排除；行 1 是代码
    expect(result).toBe(2);
  });

  // ── 场景 5：空行保留 ──────────────────────────────────────

  it('空行保留', async () => {
    // 行 0：expression_statement
    // 行 1：（空行，没有任何 AST 节点覆盖）
    // 行 2：expression_statement
    const mockTree = tree([
      node('expression_statement', 0, 0),
      node('expression_statement', 2, 2),
    ]);
    setupMockParser(mockTree);
    (TreeSitterManager.getLanguage as any as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await repo.countNonCommentLines(
      'line1\n\nline3\n',
      '/path/to/file.ts',
    );

    expect(result).toBe(3);
  });

  // ── 场景 6：不支持的语言 ──────────────────────────────────

  it('不支持的语言 fallback 到总行数', async () => {
    (TreeSitterManager.getLanguage as any as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await repo.countNonCommentLines(
      'line1\nline2\nline3\n',
      '/path/to/file.unknown',
    );

    expect(result).toBe(3);
  });

  // ── 混合场景：代码 + 注释 + 空行 ─────────────────────────

  it('混合场景正确排除注释并保留空行', async () => {
    // 行 0: code
    // 行 1: // comment (comment node)
    // 行 2: (empty)
    // 行 3: code
    // 行 4: (empty)
    // 行 5: /*   (comment node, 多行)
    // 行 6: multi
    // 行 7: */
    // 行 8: code
    const mockTree = tree([
      node('expression_statement', 0, 0),
      node('comment', 1, 1),
      node('expression_statement', 3, 3),
      node('comment', 5, 7),
      node('expression_statement', 8, 8),
    ]);
    setupMockParser(mockTree);
    (TreeSitterManager.getLanguage as any as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await repo.countNonCommentLines(
      'code1\n// comment\n\ncode2\n\n/*\nmulti\n*/\ncode3\n',
      '/path/to/file.ts',
    );

    // 保留的行：0(code), 2(empty), 3(code), 4(empty), 8(code) → 5 行
    expect(result).toBe(5);
  });

  // ── 边界：只有注释 ────────────────────────────────────────

  it('全注释文件返回空行数（0 行代码行）', async () => {
    const mockTree = tree([
      node('comment', 0, 2),
    ]);
    setupMockParser(mockTree);
    (TreeSitterManager.getLanguage as any as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await repo.countNonCommentLines(
      '// file header\n// author: test\n// TODO: refactor\n',
      '/path/to/file.ts',
    );

    expect(result).toBe(0);
  });

  // ── 边界：空文件 ──────────────────────────────────────────

  it('空文件返回 0', async () => {
    const mockTree = tree([]);
    const parser = {
      setLanguage: vi.fn(),
      parse: vi.fn().mockReturnValue(mockTree),
    };
    (TreeSitterManager.getParser as any as ReturnType<typeof vi.fn>).mockResolvedValue(parser);
    (TreeSitterManager.getLanguage as any as ReturnType<typeof vi.fn>).mockResolvedValue({});

    const result = await repo.countNonCommentLines('', '/path/to/file.ts');

    expect(result).toBe(0);
  });

  // ── 边界：tree-sitter 初始化失败时 fallback ──────────────

  it('AST 解析失败时 fallback 到总行数', async () => {
    (TreeSitterManager.getLanguage as any as ReturnType<typeof vi.fn>).mockResolvedValue({});
    const mockParser = {
      setLanguage: vi.fn(),
      parse: vi.fn().mockImplementation(() => { throw new Error('parse error'); }),
    };
    (TreeSitterManager.getParser as any as ReturnType<typeof vi.fn>).mockResolvedValue(mockParser);

    const result = await repo.countNonCommentLines(
      'line1\nline2\nline3\n',
      '/path/to/file.ts',
    );

    expect(result).toBe(3);
  });
});
