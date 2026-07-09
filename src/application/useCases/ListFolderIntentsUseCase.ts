/**
 * @intent
 * 扫描指定文件夹（非递归），提取每个文件的 @intent 注释，以结构化意图清单返回。
 * 编排两个数据层能力：IFileRepository（文件扫描）+ IntentExtractorFn（意图提取）。
 * 输入：folderPath；输出：{ folder, subdirectories, files: { file, intent }[] }。
 * 不含 LLM 调用，纯 IO + 字符串匹配。
 * 被 MCP Tool 和 CLI Command 共同消费。
 */

import { IFileRepository } from '../../data/repositories/IFileRepository';

/** 从文件内容中提取 @intent 文本，未找到返回 null */
export type IntentExtractorFn = (content: string) => string | null;

export interface FileIntent {
  file: string;
  intent: string | null;
}

export interface ListFolderIntentsResult {
  folder: string;
  subdirectories: string[];
  files: FileIntent[];
}

function defaultExtractIntent(content: string): string | null {
  const match = content.match(/@intent[:\s]+(.+)/);
  return match?.[1]?.trim() ?? null;
}

export class ListFolderIntentsUseCase {
  private fileRepo: IFileRepository;
  private extractIntent: IntentExtractorFn;

  constructor(
    fileRepo: IFileRepository,
    extractIntent: IntentExtractorFn = defaultExtractIntent
  ) {
    this.fileRepo = fileRepo;
    this.extractIntent = extractIntent;
  }

  /**
   * @contract
   * 扫描文件夹，提取所有文件的 @intent。
   * 输入：folder - 目标文件夹路径（绝对路径）
   * 输出：ListFolderIntentsResult - 包含文件夹路径、子目录名、文件意图列表
   * 副作用：读文件系统
   */
  async execute(folder: string): Promise<ListFolderIntentsResult> {
    // @step: 扫描文件夹获取所有文件（非递归，不过滤扩展名）
    const filePaths = await this.fileRepo.scanDirectory(folder, { recursive: false });
    // @step: 获取子目录名
    const subdirectories = await this.fileRepo.listSubdirectories(folder);
    // @step: 对每个文件提取 @intent
    const files: FileIntent[] = [];

    for (const filePath of filePaths) {
      try {
        // @step: 读取文件内容
        const content = await this.fileRepo.readFile(filePath);
        // @step: 提取 @intent
        const intent = this.extractIntent(content);
        // @step: 取文件名（不含路径）
        const fileName = filePath.split(/[\/\\]/).pop() || filePath;
        files.push({ file: fileName, intent });
      } catch {
        // @boundary: 文件读取失败时跳过，不中断整体流程
      }
    }

    return { folder, subdirectories, files };
  }
}
