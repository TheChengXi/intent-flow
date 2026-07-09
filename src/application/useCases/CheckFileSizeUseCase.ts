import { IUseCase } from './IUseCase';
import { FileSizeCheckResult, FileSizeCheckInput } from '../../data/entities/FileSizeCheckResult';
import { IFileRepository } from '../../data/repositories/IFileRepository';

/**
 * @intent
 * 编排 fileRepo 读取文件行数 → 判断是否超过阈值。用于触发重构判断。
 * 边界：阈值默认 400 行；入口为目录时递归扫描所有文件
 */

export class CheckFileSizeUseCase implements IUseCase<FileSizeCheckInput, FileSizeCheckResult[]> {
  constructor(private fileRepo: IFileRepository) {}

  // @contract: execute(input: FileSizeCheckInput) => Promise<FileSizeCheckResult[]>
  // @step: [验证文件] 验证文件是否存在
  // @step: [获取行数] 获取文件行数
  // @step: [检查阈值] 检查是否超过阈值
  // @step: [返回结果] 返回检查结果列表
  // @boundary: 文件不存在时抛出错误
  // @boundary: 阈值默认为 400 行
  async execute(input: FileSizeCheckInput): Promise<FileSizeCheckResult[]> {
    const { filePath, workspaceRoot, threshold = 400 } = input;

    // 验证文件存在
    const exists = await this.fileRepo.exists(filePath);
    if (!exists) {
      throw new Error(`File not found: ${filePath}`);
    }

    // 获取文件行数
    const lineCount = await this.fileRepo.getLineCount(filePath);

    // 检查是否超过阈值
    const needsRefactor = lineCount > threshold;
    const exceedLines = needsRefactor ? lineCount - threshold : 0;

    const result: FileSizeCheckResult = {
      filePath,
      lineCount,
      exceedLines,
      needsRefactor
    };

    // TODO: 递归检查依赖树中的所有文件

    return [result];
  }
}
