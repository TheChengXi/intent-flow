import { IUseCase } from './IUseCase';
import { ICodeParserRepository } from '../../data/repositories/ICodeParserRepository';
import { IFileRepository } from '../../data/repositories/IFileRepository';
import { LanguageConfig } from '../../data/services/core/LanguageConfig';
import * as path from 'path';

/**
 * @intent
 * 编排 fileRepo（验证文件存在）→ LanguageConfig（检测语言）→ parserRepo（搜索定义）的三步流程。
 * 边界：文件不存在抛错；未找到类型定义返回 null 而非报错
 */

// @entity: SearchTypeDefinitionInput
// 搜索类型定义输入
export interface SearchTypeDefinitionInput {
  typeName: string;   // 类型名
  filePath: string;   // 文件路径
  language?: string;  // 编程语言（可选）
}

export class SearchTypeDefinitionUseCase implements IUseCase<SearchTypeDefinitionInput, string | null> {
  constructor(
    private fileRepo: IFileRepository,
    private parserRepo: ICodeParserRepository
  ) {}

  // @contract: execute(input: SearchTypeDefinitionInput) => Promise<string | null>
  // @step: [验证文件] 验证文件是否存在
  // @step: [检测语言] 如果未提供语言，从文件扩展名检测
  // @step: [搜索定义] 使用 parserRepo 搜索类型定义
  // @step: [返回结果] 返回类型定义代码或 null
  // @boundary: 文件不存在时抛出错误
  // @boundary: 找不到类型定义时返回 null
  async execute(input: SearchTypeDefinitionInput): Promise<string | null> {
    const { typeName, filePath, language } = input;

    // 验证文件存在
    const exists = await this.fileRepo.exists(filePath);
    if (!exists) {
      throw new Error(`File not found: ${filePath}`);
    }

    // 检测语言
    const detectedLanguage = language || this.detectLanguage(filePath);

    // 搜索类型定义
    const result = await this.parserRepo.searchTypeDefinition(
      typeName,
      filePath,
      detectedLanguage
    );

    return result;
  }

  private detectLanguage(filePath: string): string {
    return LanguageConfig.getLanguageFromExtension(path.extname(filePath)) || 'typescript';
  }
}
