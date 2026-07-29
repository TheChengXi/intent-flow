/**
 * @intent
 * 将项目中每个文件的 @intent 注释实时映射到 .cdd/intents/ 目录树。
 * 每个源文件 → 一个 .md 文件（含路径 + @intent 原文）。
 * agent 可直接用 ls/cat/grep 扫 .cdd/intents/ 快速了解项目全貌。
 * 不含 LLM 调用，纯 IO + 字符串匹配。
 */

import { IFileRepository } from '../../data/repositories/IFileRepository';
import { extractIntentFromLines } from '../../data/services/codeContext/extractors/IntentExtractor';
import * as path from 'path';
import picomatch from 'picomatch';

// ==================== 类型定义 ====================

export interface FullSyncInput {
  /** 项目根目录（绝对路径，用于定位 .cdd/intents/ 输出目录） */
  sourceRoot: string;
  /** 要扫描的文件夹列表（相对 sourceRoot 的路径），为空时默认扫整个 sourceRoot */
  sourceRoots?: string[];
  /** 额外的排除模式（glob 语法），叠加在默认排除之上 */
  excludePatterns?: string[];
}

export interface FullSyncResult {
  filesCreated: number;
  filesUpdated: number;
  filesDeleted: number;
}

export interface SyncFileInput {
  sourceRoot: string;
  /** 发生变更的源文件绝对路径 */
  filePath: string;
  /** 要扫描的文件夹列表，增量操作时传入以确保文件属于已选目录 */
  sourceRoots?: string[];
  /** 额外的排除模式（glob 语法），叠加在默认排除之上 */
  excludePatterns?: string[];
}

export interface SyncFileResult {
  projectionWritten: boolean;
}

export interface RemoveFileInput {
  sourceRoot: string;
  /** 被删除的源文件绝对路径 */
  filePath: string;
  /** 要扫描的文件夹列表，增量操作时传入以确保文件属于已选目录 */
  sourceRoots?: string[];
  /** 额外的排除模式（glob 语法），叠加在默认排除之上 */
  excludePatterns?: string[];
}

export interface RemoveFileResult {
  projectionDeleted: boolean;
}

// ==================== 默认 intent 提取器 ====================
// 委托给 IntentExtractor.extractIntentFromLines，支持多格式 /** */、//、# 等。
// 不自己实现 regex，避免与 IntentExtractor 能力不一致。

/**
 * 判断文件是否应该被排除（不扫描、不投射）
 * 默认排除：所有点开头文件/目录、node_modules
 * 可叠加用户配置的 glob 模式
 */
function isExcluded(relPath: string, extraPatterns?: string[]): boolean {
  const parts = relPath.split(/[\/\\]/);
  if (parts.some(p => p.startsWith('.') || p === 'node_modules')) {
    return true;
  }
  if (extraPatterns && extraPatterns.length > 0) {
    const isMatch = picomatch(extraPatterns, { dot: true });
    return isMatch(relPath);
  }
  return false;
}

// ==================== UseCase ====================

export class ProjectIntentsToFilesUseCase {
  private fileRepo: IFileRepository;

  constructor(fileRepo: IFileRepository) {
    this.fileRepo = fileRepo;
  }

  // ==================== 全量同步 ====================

  /**
   * @contract
   * 全量扫描 sourceRoot，重建 .cdd/intents/ 投射文件树。
   * 输入：sourceRoot - 项目根目录绝对路径
   * 输出：FullSyncResult - 创建/更新/删除了多少投射文件
   * 副作用：写文件系统，清理过时投射文件
   */
  async fullSync(input: FullSyncInput): Promise<FullSyncResult> {
    const { sourceRoot, sourceRoots, excludePatterns } = input;
    const outputRoot = path.join(sourceRoot, '.cdd', 'intents');
    const result: FullSyncResult = { filesCreated: 0, filesUpdated: 0, filesDeleted: 0 };

    // 1. 扫描源文件
    const allFiles: string[] = [];
    if (sourceRoots && sourceRoots.length > 0) {
      for (const relRoot of sourceRoots) {
        const absRoot = path.resolve(sourceRoot, relRoot);
        const exists = await this.fileRepo.exists(absRoot).catch(() => false);
        if (!exists) continue;
        const files = await this.fileRepo.scanDirectory(absRoot, { recursive: true });
        allFiles.push(...files);
      }
    } else {
      const files = await this.fileRepo.scanDirectory(sourceRoot, { recursive: true });
      allFiles.push(...files);
    }

    // 2. 记录本次生成的文件路径，用于后续清理
    const activeProjectionPaths = new Set<string>();

    // 3. 处理每个文件
    for (const absPath of allFiles) {
      const relPath = path.relative(sourceRoot, absPath);
      if (isExcluded(relPath, excludePatterns)) continue;

      const content = await this.fileRepo.readFile(absPath);
      const intent = extractIntentFromLines(content.split('\n'));
      const projPath = path.join(outputRoot, relPath) + '.md';

      if (intent) {
        // 有 intent → 写正常 .md
        const projContent = this.buildProjectionContent(relPath, intent);
        const exists = await this.fileRepo.exists(projPath);
        await this.fileRepo.writeFile(projPath, projContent);
        if (exists) result.filesUpdated++;
        else result.filesCreated++;
        activeProjectionPaths.add(projPath);
        // 如果之前标记为 .lost.md，清除它（文件重新有了 intent）
        const lostPath = projPath.replace(/\.md$/, '.lost.md');
        if (await this.fileRepo.exists(lostPath)) {
          await this.fileRepo.deleteFile(lostPath);
        }
      } else {
        // 无 intent → 重命名 .md 为 .lost.md（保留历史记录）
        const lostPath = projPath.replace(/\.md$/, '.lost.md');
        if (await this.fileRepo.exists(projPath)) {
          await this.fileRepo.renameFile(projPath, lostPath);
          result.filesDeleted++;
        }
      }
    }

    // 4. 清 .cdd/intents/ 下所有过时的 .md 文件
    await this.cleanupStaleProjections(outputRoot, activeProjectionPaths);

    return result;
  }

  // ==================== 单文件增量同步 ====================

  /** 判断文件是否在指定的 sourceRoots 范围内 */
  private isInRoots(relPath: string, sourceRoots?: string[]): boolean {
    if (!sourceRoots || sourceRoots.length === 0) return true;
    return sourceRoots.some(r => {
      if (r === '.') return true; // 根目录匹配一切
      const normR = r.replace(/\\/g, '/');
      const normP = relPath.replace(/\\/g, '/');
      return normP === normR || normP.startsWith(normR + '/');
    });
  }

  /**
   * @contract
   * 单个源文件变更后，更新或删除对应的投射文件。
   * 输入：sourceRoot + filePath（源文件绝对路径）
   * 输出：SyncFileResult
   */
  async syncFile(input: SyncFileInput): Promise<SyncFileResult> {
    const { sourceRoot, filePath, sourceRoots, excludePatterns } = input;
    const relPath = path.relative(sourceRoot, filePath);
    if (!relPath || relPath.startsWith('..') || isExcluded(relPath, excludePatterns) || !this.isInRoots(relPath, sourceRoots)) {
      return { projectionWritten: false };
    }

    const outputRoot = path.join(sourceRoot, '.cdd', 'intents');
    const projPath = path.join(outputRoot, relPath) + '.md';

    const content = await this.fileRepo.readFile(filePath);
    const intent = extractIntentFromLines(content.split('\n'));

    if (intent) {
      const projContent = this.buildProjectionContent(relPath, intent);
      await this.fileRepo.ensureDir(path.dirname(projPath));
      await this.fileRepo.writeFile(projPath, projContent);
      // 清除之前的 .lost.md 标记
      const lostPath = projPath.replace(/\.md$/, '.lost.md');
      if (await this.fileRepo.exists(lostPath)) {
        await this.fileRepo.deleteFile(lostPath);
      }
    } else {
      // 无 intent → 转为 .lost.md（保留历史记录）
      const lostPath = projPath.replace(/\.md$/, '.lost.md');
      if (await this.fileRepo.exists(projPath)) {
        await this.fileRepo.renameFile(projPath, lostPath);
      }
    }

    return { projectionWritten: !!intent };
  }

  /**
   * @contract
   * 源文件被删除后，清除对应的投射文件。
   * 输入：sourceRoot + filePath（被删源文件绝对路径）
   * 输出：RemoveFileResult
   */
  async removeFile(input: RemoveFileInput): Promise<RemoveFileResult> {
    const { sourceRoot, filePath, sourceRoots, excludePatterns } = input;
    const relPath = path.relative(sourceRoot, filePath);
    if (!relPath || relPath.startsWith('..') || isExcluded(relPath, excludePatterns) || !this.isInRoots(relPath, sourceRoots)) {
      return { projectionDeleted: false };
    }

    const outputRoot = path.join(sourceRoot, '.cdd', 'intents');
    const projPath = path.join(outputRoot, relPath) + '.md';
    const lostPath = projPath.replace(/\.md$/, '.lost.md');

    let deleted = false;
    // 源文件被物理删除 → 两种文件都删掉，不留垃圾
    if (await this.fileRepo.exists(projPath)) {
      await this.fileRepo.deleteFile(projPath);
      deleted = true;
    }
    if (await this.fileRepo.exists(lostPath)) {
      await this.fileRepo.deleteFile(lostPath);
    }

    return { projectionDeleted: deleted };
  }

  // ==================== 内部方法 ====================

  /** 构建单个文件的投射内容 */
  private buildProjectionContent(relPath: string, intent: string): string {
    const fileName = path.basename(relPath);
    const normPath = relPath.replace(/\\/g, '/');
    return `# ${fileName}\n\n\`${normPath}\`\n\n**intent:** ${intent}\n`;
  }

  /** 清除 .cdd/intents/ 下不在活跃列表中的文件 */
  private async cleanupStaleProjections(
    outputRoot: string,
    activePaths: Set<string>
  ): Promise<void> {
    const allFiles = await this.fileRepo.scanDirectory(outputRoot, { recursive: true });
    for (const absPath of allFiles) {
      // 清理过时的 .md（不在本次扫描结果中且没有对应的 .lost.md）
      if (absPath.endsWith('.md') && !activePaths.has(absPath)) {
        // 检查是否有对应的 .lost.md（说明是故意保留的）
        const lostPath = absPath.replace(/\.md$/, '.lost.md');
        if (!await this.fileRepo.exists(lostPath)) {
          await this.fileRepo.deleteFile(absPath);
        }
      }
    }
  }
}
