import { ICodeParserRepository } from '../../repositories/ICodeParserRepository';
import { FunctionDefinition } from '../../entities/FunctionDefinition';
import { FunctionDefinitionSearcher } from '../codeContext/searchers/FunctionDefinitionSearcher';
import { TypeDefinitionSearcher } from '../codeContext/searchers/TypeDefinitionSearcher';
import { FunctionCallExtractor } from '../codeContext/extractors/FunctionCallExtractor';
import { TypeReferenceExtractor } from '../codeContext/extractors/TypeReferenceExtractor';
import { ImportExtractor } from '../codeContext/extractors/import/ImportExtractor';
import { TreeSitterManager } from '../tree-sitter/TreeSitterManager';
import { LanguageConfig } from '../tree-sitter/LanguageConfig';
import * as path from 'path';

/**
 * @intent
 * ICodeParserRepository 实现，编排多个 tree-sitter 分析器对外提供统一接口。countNonCommentLines 复用 LanguageConfig 的扩展名映射 + tree-sitter AST 遍历识别 comment 节点，排除注释行后返回纯代码行数。
 */

export class CodeParserRepositoryImpl implements ICodeParserRepository {

  async parse(content: string, language: string): Promise<any> {
    try {
      await TreeSitterManager.init();
      const lang = await TreeSitterManager.getLanguage(language);

      if (!lang) {
        console.warn(`[CodeParserRepository] Tree-sitter 不支持该语言: ${language}`);
        return null;
      }

      const parser = await TreeSitterManager.getParser();
      parser.setLanguage(lang);
      const tree = parser.parse(content);

      return tree;
    } catch (error) {
      console.warn(`[CodeParserRepository] 解析 AST 失败:`, error);
      return null;
    }
  }

  async searchFunctionDefinition(
    functionName: string,
    filePath: string,
    language: string
  ): Promise<FunctionDefinition | null> {
    const result = await FunctionDefinitionSearcher.searchInFile(functionName, filePath, language);

    if (result) {
      return {
        functionName: result.functionName,
        code: result.code,
        startLine: result.startLine,
        endLine: result.endLine,
        contract: result.contract,
        filePath: filePath
      };
    }

    return null;
  }

  async searchTypeDefinition(
    typeName: string,
    filePath: string,
    language: string
  ): Promise<string | null> {
    return await TypeDefinitionSearcher.searchInFile(typeName, filePath, language);
  }

  async extractFunctionCalls(code: string, language: string): Promise<string[]> {
    return await FunctionCallExtractor.extractFromText(code, language);
  }

  async extractTypeReferences(code: string, language: string): Promise<string[]> {
    return await TypeReferenceExtractor.extractFromContractLine(code, language);
  }

  async extractImports(
    content: string,
    currentDir: string,
    language: string
  ): Promise<string[]> {
    return await ImportExtractor.extractImportedFiles(content, currentDir, language);
  }

  async searchContract(
    _functionName: string,
    _workspaceRoot: string
  ): Promise<string | null> {
    throw new Error('searchContract is a VSCode-specific method. Use VSCodeContractSearcher directly.');
  }

  // ──────────────────────────────────────────────
  // countNonCommentLines
  // ──────────────────────────────────────────────

  /**
   * @contract
   * 统计排除注释后的纯代码行数（空行保留）。
   * 输入：content - 文件内容；filePath - 文件路径（用于推断编程语言）
   * 输出：排除注释后的纯代码行数
   * 副作用：无
   */
  async countNonCommentLines(content: string, filePath: string): Promise<number> {
    // @step: 处理空文件
    if (content.length === 0) return 0;

    // @step: 从 filePath 推断编程语言（复用 LanguageConfig 的统一映射）
    const language = LanguageConfig.getLanguageFromExtension(path.extname(filePath));
    if (!language) {
      // @boundary: 无法识别语言，fallback 到总行数
      return this.countTotalLines(content);
    }

    // @step: 解析 AST（复用已有的 parse 方法）
    const tree = await this.parse(content, language);
    if (!tree || !tree.rootNode) {
      // @boundary: 解析失败，fallback 到总行数
      return this.countTotalLines(content);
    }

    // @step: 遍历 AST，收集所有 type === 'comment' 节点的行范围
    const commentRows = new Set<number>();
    const nonCommentRows = new Set<number>();

    this.collectNodeRows(tree.rootNode, commentRows, nonCommentRows);

    // @step: 计算总行数（基于 AST 节点的最大行号）
    let maxRow = -1;
    for (const row of commentRows) maxRow = Math.max(maxRow, row);
    for (const row of nonCommentRows) maxRow = Math.max(maxRow, row);
    const totalLines = maxRow + 1;

    // @step: 逐行判断是否完全落在注释范围内
    let codeLines = 0;
    for (let row = 0; row < totalLines; row++) {
      if (nonCommentRows.has(row)) {
        // @step: 有代码节点或是代码结构的一部分 → 保留
        codeLines++;
      } else if (!commentRows.has(row)) {
        // @step: 空行（无代码节点也无注释节点）→ 保留
        codeLines++;
      }
      // 纯注释行：排除
    }

    return codeLines;
  }

  // ──────────────────────────────────────────────
  // Private Helpers
  // ──────────────────────────────────────────────



  /**
   * @contract
   * 统计内容总行数（处理末尾换行和空文件）。
   * 输入：content - 文件内容
   * 输出：行数
   * 副作用：无
   */
  private countTotalLines(content: string): number {
    if (content.length === 0) return 0;
    const lines = content.split('\n');
    // @boundary: 末尾有换行符时，最后一个空元素不计入行数
    if (lines[lines.length - 1] === '' && content.endsWith('\n')) {
      return lines.length - 1;
    }
    return lines.length;
  }

  /**
   * @contract
   * 递归遍历 AST 节点，收集注释行和非注释行的范围。
   * 输入：node - AST 节点；commentRows - 注释行集合；nonCommentRows - 非注释行集合
   * 副作用：修改 commentRows / nonCommentRows
   */
  private collectNodeRows(
    node: any,
    commentRows: Set<number>,
    nonCommentRows: Set<number>
  ): void {
    if (!node || !node.type || !node.startPosition || !node.endPosition) return;

    const { type, startPosition, endPosition, children } = node;

    if (type === 'comment') {
      // @step: 注释节点 → 记录其所有行
      for (let row = startPosition.row; row <= endPosition.row; row++) {
        commentRows.add(row);
      }
    } else if (type !== 'program') {
      // @step: 非注释、非根节点 → 记录其所有行
      for (let row = startPosition.row; row <= endPosition.row; row++) {
        nonCommentRows.add(row);
      }
    }

    // @step: 递归遍历子节点
    if (children && Array.isArray(children)) {
      for (const child of children) {
        this.collectNodeRows(child, commentRows, nonCommentRows);
      }
    }
  }

}
