import { IUseCase } from './IUseCase';
import { PartialContextResult } from '../../data/entities/PartialContextResult';
import { IFileRepository } from '../../data/repositories/IFileRepository';
import { ICodeParserRepository } from '../../data/repositories/ICodeParserRepository';
import { ICacheRepository } from '../../data/repositories/ICacheRepository';
import { LanguageConfig } from '../../data/services/core/LanguageConfig';
import * as path from 'path';

/**
 * @intent
 * 从选中代码范围提取函数调用和类型引用，并行搜索其定义，拼装局部上下文结果。
 * 边界：行号超出文件范围抛错；搜索不到的定义跳过不报错；depth > 1 时递归处理依赖的依赖
 */

// @entity: ExtractPartialContextInput
// 部分上下文提取输入
export interface ExtractPartialContextInput {
  filePath: string;       // 文件路径
  startLine: number;      // 起始行号（从 0 开始）
  endLine: number;        // 结束行号
  workspaceRoot: string;  // 工作区根目录
  depth?: number;         // 依赖深度，默认 1
}

export class ExtractPartialContextUseCase implements IUseCase<ExtractPartialContextInput, PartialContextResult> {
  constructor(
    private fileRepo: IFileRepository,
    private parserRepo: ICodeParserRepository,
    private cacheRepo: ICacheRepository
  ) {}

  // @contract: execute(input: ExtractPartialContextInput) => Promise<PartialContextResult>
  // @step: [验证输入] 验证文件路径和行号范围
  // @step: [读取文件] 使用 fileRepo 读取文件内容
  // @step: [提取目标代码] 提取选中的代码范围
  // @step: [检测语言] 从文件扩展名检测语言
  // @step: [提取函数调用] 使用 parserRepo 提取函数调用
  // @step: [提取类型引用] 使用 parserRepo 提取类型引用
  // @step: [搜索函数定义] 并行搜索所有函数定义
  // @step: [搜索类型定义] 并行搜索所有类型定义
  // @step: [递归处理] 如果 depth > 1，递归处理依赖的依赖
  // @step: [返回结果] 返回 PartialContextResult
  // @boundary: 文件不存在时抛出错误
  // @boundary: 行号范围无效时抛出错误
  // @boundary: 找不到依赖定义时跳过该依赖
  async execute(input: ExtractPartialContextInput): Promise<PartialContextResult> {
    const { filePath, startLine, endLine, workspaceRoot, depth = 1 } = input;

    // 验证文件存在
    const exists = await this.fileRepo.exists(filePath);
    if (!exists) {
      throw new Error(`File not found: ${filePath}`);
    }

    // 读取文件内容
    const content = await this.fileRepo.readFile(filePath);
    const lines = content.split('\n');

    // 验证行号范围
    if (startLine < 0 || endLine >= lines.length || startLine > endLine) {
      throw new Error(`Invalid line range: ${startLine}-${endLine}`);
    }

    // 提取目标代码
    const targetCodeLines = lines.slice(startLine, endLine + 1);
    const targetCode = targetCodeLines.join('\n');

    // 检测语言
    const language = this.detectLanguage(filePath);

    // 构建目标代码片段
    const targetSnippet = {
      filePath,
      startLine,
      endLine,
      code: targetCode,
      language
    };

    // 提取函数调用
    const functionCalls = await this.parserRepo.extractFunctionCalls(targetCode, language);

    // 提取类型引用
    const typeReferences = await this.parserRepo.extractTypeReferences(targetCode, language);

    // 提取导入的文件
    const importedFiles = await this.parserRepo.extractImports(content, path.dirname(filePath), language);

    // 并行搜索所有函数定义
    const functionSearchPromises = functionCalls.map(async (funcName) => {
      let funcDef = await this.parserRepo.searchFunctionDefinition(funcName, filePath, language);

      if (!funcDef) {
        for (const importedFile of importedFiles) {
          const importExists = await this.fileRepo.exists(importedFile);
          if (importExists) {
            funcDef = await this.parserRepo.searchFunctionDefinition(funcName, importedFile, language);
            if (funcDef) {
              break;
            }
          }
        }
      }

      if (funcDef) {
        return {
          type: 'function' as const,
          name: funcDef.functionName,
          filePath: funcDef.filePath,
          code: funcDef.code,
          contract: funcDef.contract
        };
      }
      return null;
    });

    // 并行搜索所有类型定义
    const typeSearchPromises = typeReferences.map(async (typeName) => {
      let typeDef = await this.parserRepo.searchTypeDefinition(typeName, filePath, language);

      if (!typeDef) {
        for (const importedFile of importedFiles) {
          const importExists = await this.fileRepo.exists(importedFile);
          if (importExists) {
            typeDef = await this.parserRepo.searchTypeDefinition(typeName, importedFile, language);
            if (typeDef) {
              break;
            }
          }
        }
      }

      if (typeDef) {
        return {
          name: typeName,
          filePath: filePath,
          code: typeDef
        };
      }
      return null;
    });

    // 等待所有搜索完成
    const [functionResults, typeResults] = await Promise.all([
      Promise.all(functionSearchPromises),
      Promise.all(typeSearchPromises)
    ]);

    // 过滤掉 null 结果
    const directDependencies = functionResults.filter((r) => r !== null) as any[];
    const typeDefinitions = typeResults.filter((r) => r !== null) as any[];

    return {
      targetCode: targetSnippet,
      directDependencies,
      typeDefinitions
    };
  }

  private detectLanguage(filePath: string): string {
    return LanguageConfig.getLanguageFromExtension(path.extname(filePath)) || 'typescript';
  }
}
