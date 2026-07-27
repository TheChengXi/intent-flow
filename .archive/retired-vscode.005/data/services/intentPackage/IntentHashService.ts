import { IFileRepository } from '../../repositories/IFileRepository';
import { createHash } from 'crypto';

/**
 * @intent
 * 聚合哈希计算服务。
 * 给定文件夹或文件列表，提取每个文件的 @intent 并计算 SHA256 聚合哈希。
 * 哈希值用于判断意图包是否与当前 @intent 一致（是否 stale）。
 * 依赖注入：fileRepo 用于读文件，extractIntentFromContent 用于从文件内容中提取 @intent。
 * 后者的默认实现在第一阶段支持 JavaScript/TypeScript，未来可以注册更多语言提取器。
 */

/** 从文件内容中提取 @intent 文本，未找到返回 null */
export type IntentExtractorFn = (content: string) => string | null;

function defaultExtractIntent(content: string): string | null {
  const match = content.match(/@intent[:\s]+(.+)/);
  return match?.[1]?.trim() ?? null;
}

export class IntentHashService {
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
   * 递归扫描文件夹内所有文件，提取 @intent 并计算聚合哈希。
   * 输入：folderPath - 文件夹路径
   * 输出：聚合 SHA256 哈希字符串
   * 错误：文件夹不存在时抛出
   * 副作用：读文件系统
   */
  async calcHashForFolder(folderPath: string): Promise<string> {
    // @step: 递归扫描文件夹获取所有文件路径
    const files = await this.fileRepo.scanDirectory(folderPath, { recursive: true });
    // @step: 对文件列表排序（保证 hash 稳定）
    files.sort();
    // @step: 调用 calcHashForFiles
    return this.calcHashForFiles(files);
  }

  /**
   * @contract
   * 针对指定的文件列表计算 @intent 聚合哈希。
   * 输入：filePaths - 文件路径列表（推荐先排序）
   * 输出：聚合 SHA256 哈希字符串
   * 错误：无（文件不存在或解析失败时忽略该文件）
   * 副作用：读文件系统
   */
  async calcHashForFiles(filePaths: string[]): Promise<string> {
    // @step: 对每个文件读取内容并提取 @intent
    const intents: string[] = [];

    for (const fp of filePaths) {
      try {
        const content = await this.fileRepo.readFile(fp);
        const intent = this.extractIntent(content);
        if (intent !== null) {
          intents.push(intent);
        }
      } catch {
        // @boundary: 文件不存在或无法读取时跳过
      }
    }

    // @step: 将所有 intent 按路径排序后拼接
    const canonical = intents.join('\n');

    // @step: 计算 SHA256 并返回
    return createHash('sha256').update(canonical, 'utf-8').digest('hex');
  }
}
