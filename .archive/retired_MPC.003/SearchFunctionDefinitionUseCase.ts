import { IUseCase } from './IUseCase';
import { FunctionDefinition } from '../../data/entities/FunctionDefinition';
import { ICodeParserRepository } from '../../data/repositories/ICodeParserRepository';
import { IFileRepository } from '../../data/repositories/IFileRepository';

// @intent: 搜索函数定义用例，在文件中搜索函数定义

// @entity: SearchFunctionDefinitionInput
// 搜索函数定义输入
export interface SearchFunctionDefinitionInput {
  functionName: string;  // 函数名
  filePath: string;      // 文件路径
  language?: string;     // 编程语言（可选）
}

export class SearchFunctionDefinitionUseCase implements IUseCase<SearchFunctionDefinitionInput, FunctionDefinition | null> {
  constructor(
    private fileRepo: IFileRepository,
    private parserRepo: ICodeParserRepository
  ) {}

  // @contract: execute(input: SearchFunctionDefinitionInput) => Promise<FunctionDefinition | null>
  // @step: [验证文件] 验证文件是否存在
  // @step: [检测语言] 如果未提供语言，从文件扩展名检测
  // @step: [搜索定义] 使用 parserRepo 搜索函数定义
  // @step: [返回结果] 返回函数定义或 null
  // @boundary: 文件不存在时抛出错误
  // @boundary: 找不到函数定义时返回 null
  async execute(input: SearchFunctionDefinitionInput): Promise<FunctionDefinition | null> {
    const { functionName, filePath, language } = input;

    // 验证文件存在
    const exists = await this.fileRepo.exists(filePath);
    if (!exists) {
      throw new Error(`File not found: ${filePath}`);
    }

    // 检测语言
    const detectedLanguage = language || this.detectLanguage(filePath);

    // 搜索函数定义
    const result = await this.parserRepo.searchFunctionDefinition(
      functionName,
      filePath,
      detectedLanguage
    );

    return result;
  }

  private detectLanguage(filePath: string): string {
    const ext = filePath.substring(filePath.lastIndexOf('.')).toLowerCase();
    const languageMap: { [key: string]: string } = {
      '.ts': 'typescript',
      '.tsx': 'tsx',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.py': 'python',
      '.go': 'go',
      '.cpp': 'cpp',
      '.c': 'c',
      '.rs': 'rust',
      '.java': 'java'
    };
    return languageMap[ext] || 'typescript';
  }
}
