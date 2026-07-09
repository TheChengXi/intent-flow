import { IUseCase } from './IUseCase';
import { ICodeParserRepository } from '../../data/repositories/ICodeParserRepository';

// @intent: 搜索契约用例，搜索函数的 @contract 注释

// @entity: SearchContractInput
// 搜索契约输入
export interface SearchContractInput {
  functionName: string;   // 函数名
  workspaceRoot: string;  // 工作区根目录
}

export class SearchContractUseCase implements IUseCase<SearchContractInput, string | null> {
  constructor(private parserRepo: ICodeParserRepository) {}

  // @contract: execute(input: SearchContractInput) => Promise<string | null>
  // @step: [搜索契约] 使用 parserRepo 在工作区中搜索契约
  // @step: [返回结果] 返回契约文本或 null
  // @boundary: 找不到契约时返回 null
  async execute(input: SearchContractInput): Promise<string | null> {
    const { functionName, workspaceRoot } = input;

    // 搜索契约
    const result = await this.parserRepo.searchContract(functionName, workspaceRoot);

    return result;
  }
}
