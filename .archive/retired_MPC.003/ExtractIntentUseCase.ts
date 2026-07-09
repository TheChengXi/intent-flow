import { IUseCase } from './IUseCase';
import { IntentResult } from '../../data/entities/IntentResult';
import { IFileRepository } from '../../data/repositories/IFileRepository';
import * as path from 'path';

// @intent: 提取意图用例，提取文件的 @intent 注释

// @entity: ExtractIntentInput
// 提取意图输入
export interface ExtractIntentInput {
  filePath: string;  // 文件路径
}

export class ExtractIntentUseCase implements IUseCase<ExtractIntentInput, IntentResult> {
  constructor(private fileRepo: IFileRepository) {}

  // @contract: execute(input: ExtractIntentInput) => Promise<IntentResult>
  // @step: [验证文件] 验证文件是否存在
  // @step: [读取文件] 读取文件前 50 行
  // @step: [查找 @intent] 查找 @intent 注释
  // @step: [返回结果] 返回 IntentResult
  // @boundary: 文件不存在时抛出错误
  // @boundary: 未找到 @intent 时使用文件名作为意图
  async execute(input: ExtractIntentInput): Promise<IntentResult> {
    const { filePath } = input;

    // 验证文件存在
    const exists = await this.fileRepo.exists(filePath);
    if (!exists) {
      throw new Error(`File not found: ${filePath}`);
    }

    // 读取文件内容（前 50 行）
    const content = await this.fileRepo.readFile(filePath);
    const lines = content.split('\n').slice(0, 50);

    // 查找 @intent 注释
    for (const line of lines) {
      const match = line.match(/@intent[:\s]+(.+)/);
      if (match) {
        return {
          fileName: path.basename(filePath),
          intent: match[1].trim(),
          found: true
        };
      }
    }

    // 未找到 @intent，使用文件名
    return {
      fileName: path.basename(filePath),
      intent: path.basename(filePath),
      found: false
    };
  }
}
