/**
 * @intent
 * 扫描指定目录中的所有 @intent 注解。
 * 这是能力清单生成的第一步，提取所有带有 @intent 的文件信息。
 */

import { Intent } from '../../data/entities/Intent';
import { IUseCase } from './IUseCase';

export interface ScanIntentsInput {
  directoryPath: string;
  recursive?: boolean;
  extensions?: string[];
}

export interface ScanIntentsOutput {
  intents: Intent[];
  scanDuration: number;
  filesScanned: number;
  intentsFound: number;
}

export interface IScanIntentsUseCase extends IUseCase<ScanIntentsInput, ScanIntentsOutput> {
  execute(input: ScanIntentsInput): Promise<ScanIntentsOutput>;
}

export class ScanIntentsUseCase implements IScanIntentsUseCase {
  constructor(private parserRepo: any) {}

  // @contract: execute(input: ScanIntentsInput) => Promise<ScanIntentsOutput>
  // @step: [调用解析器] 调用 parserRepo.extractIntentsFromDirectory() 扫描@intent注解
  // @step: [排序结果] 按 filePath 字母序排序返回的 Intent 数组
  // @step: [统计元数据] 记录扫描耗时、扫描文件数、找到的intent数
  // @boundary: filesScanned 和 intentsFound 必须相等（一个@intent对应一个文件）
  async execute(input: ScanIntentsInput): Promise<ScanIntentsOutput> {
    const startTime = Date.now();

    try {
      const intentsFromRepo = await this.parserRepo.extractIntentsFromDirectory(
        input.directoryPath,
        input.recursive !== false,
        input.extensions
      );

      const sortedIntents = intentsFromRepo.sort((a: any, b: any) => 
        (a.filePath || '').localeCompare(b.filePath || '')
      );

      return {
        intents: sortedIntents,
        scanDuration: Date.now() - startTime,
        filesScanned: sortedIntents.length,
        intentsFound: sortedIntents.length
      };
    } catch (error) {
      throw new Error(`扫描@intent失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
