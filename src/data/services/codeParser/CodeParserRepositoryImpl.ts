import { ICodeParserRepository } from '../../repositories/ICodeParserRepository';
import { FunctionDefinition } from '../../entities/FunctionDefinition';
import { FunctionDefinitionSearcher } from '../codeContext/searchers/FunctionDefinitionSearcher';
import { TypeDefinitionSearcher } from '../codeContext/searchers/TypeDefinitionSearcher';
import { FunctionCallExtractor } from '../codeContext/extractors/FunctionCallExtractor';
import { TypeReferenceExtractor } from '../codeContext/extractors/TypeReferenceExtractor';
import { ImportExtractor } from '../codeContext/extractors/import/ImportExtractor';
import { ContractSearcher } from '../codeContext/searchers/ContractSearcher';
import { TreeSitterManager } from '../core/TreeSitterManager';

/**
 * @intent
 * ICodeParserRepository 实现，编排 7 个 tree-sitter 分析器对外提供统一接口。
 * 屏蔽：searchContract 在非 VSCode 上下文直接抛错
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
    functionName: string,
    workspaceRoot: string
  ): Promise<string | null> {
    throw new Error('searchContract is a VSCode-specific method. Use VSCodeContractSearcher directly.');
  }

}
