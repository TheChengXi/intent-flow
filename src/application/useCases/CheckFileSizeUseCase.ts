import { IUseCase } from './IUseCase';
import { FileSizeCheckResult, FileSizeCheckInput } from '../../data/entities/FileSizeCheckResult';
import { IFileRepository } from '../../data/repositories/IFileRepository';
import { ICodeParserRepository } from '../../data/repositories/ICodeParserRepository';

/**
 * @intent
 * 编排 fileRepo 读取文件 + parserRepo 排除注释统计代码行数 → 判断是否超过阈值。输入只含 filePath（绝对路径）和可选 threshold（默认 400），已移除 workspaceRoot。needsRefactor 仅在超标时输出。
 */

export class CheckFileSizeUseCase implements IUseCase<FileSizeCheckInput, FileSizeCheckResult[]> {
  constructor(
    private fileRepo: IFileRepository,
    private parserRepo: ICodeParserRepository
  ) {}

  // @contract: execute(input: FileSizeCheckInput) => Promise<FileSizeCheckResult[]>
  // @step: [验证文件] 验证文件是否存在
  // @step: [读取内容] 读取文件内容
  // @step: [统计纯代码行数] 用 parserRepo 排除注释统计行数
  // @step: [检查阈值] 检查是否超过阈值
  // @step: [返回结果] 返回检查结果列表
  // @boundary: 文件不存在时抛出错误
  // @boundary: 阈值默认为 400 行
  async execute(input: FileSizeCheckInput): Promise<FileSizeCheckResult[]> {
    const { filePath, threshold = 400 } = input;

    // @step: 验证文件存在
    const exists = await this.fileRepo.exists(filePath);
    if (!exists) {
      throw new Error(`File not found: ${filePath}`);
    }

    // @step: 读取文件内容
    const content = await this.fileRepo.readFile(filePath);

    // @step: 用 parserRepo 排除注释统计纯代码行数
    const codeLineCount = await this.parserRepo.countNonCommentLines(content, filePath);

    // @step: 检查是否超过阈值
    const exceedLines = codeLineCount > threshold ? codeLineCount - threshold : 0;

    // @step: 构造结果 — 仅超标时输出 needsRefactor
    const result: FileSizeCheckResult = {
      filePath,
      exceedLines,
      ...(codeLineCount > threshold ? { needsRefactor: true } : {}),
    };

    // TODO: 递归检查依赖树中的所有文件

    return [result];
  }
}
