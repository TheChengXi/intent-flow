/**
 * @intent
 * 将项目中每个文件的 @intent 注释实时映射到 .cdd/intents/ 目录树。
 * 每个源文件 → 一个 .md 文件（含路径 + @intent 原文）
 * 每个目录 → 一个 _index.md（含该目录下所有子文件和子目录的 intent 索引）
 * agent 可直接用 ls/cat/grep 扫 .cdd/intents/ 快速了解项目全貌。
 * 纯 IO + 字符串匹配，不含 LLM 调用。
 */

import { IFileRepository } from '../../data/repositories/IFileRepository';
import * as path from 'path';
import picomatch from 'picomatch';

// ==================== 类型定义 ====================

export interface FullSyncInput {
  /** 项目根目录（绝对路径） */
  sourceRoot: string;
  /** 额外的排除模式（glob 语法），叠加在默认排除之上 */
  excludePatterns?: string[];
}

export interface FullSyncResult {
  filesCreated: number;
  filesUpdated: number;
  filesDeleted: number;
  indexesUpdated: number;
}

export interface SyncFileInput {
  sourceRoot: string;
  /** 发生变更的源文件绝对路径 */
  filePath: string;
  /** 额外的排除模式（glob 语法），叠加在默认排除之上 */
  excludePatterns?: string[];
}

export interface SyncFileResult {
  projectionWritten: boolean;
  indexUpdated: boolean;
}

export interface RemoveFileInput {
  sourceRoot: string;
  /** 被删除的源文件绝对路径 */
  filePath: string;
  /** 额外的排除模式（glob 语法），叠加在默认排除之上 */
  excludePatterns?: string[];
}

export interface RemoveFileResult {
  projectionDeleted: boolean;
  indexUpdated: boolean;
}

/** 扁平的文件 intent 记录，用于构建目录索引 */
interface FileEntry {
  fileName: string;
  intent: string;
}

/** 目录索引数据 */
interface DirIndex {
  files: FileEntry[];
  subdirs: string[];
}

// ==================== 默认 intent 提取器 ====================

/** 从文件内容中提取 @intent 文本，支持两种格式 */
function extractIntent(content: string): string | null {
  // 匹配 /** @intent\n * 多行内容\n */ 块注释格式
  const blockMatch = content.match(/\/\*\*\s*\n\s*\*\s*@intent\s*\n([\s\S]*?)\s*\*\//);
  if (blockMatch) {
    // 提取多行内容，去掉每行开头的 * 和空格
    const lines = blockMatch[1].split('\n');
    const cleaned = lines
      .map(l => l.replace(/^\s*\*\s?/, '').trim())
      .filter(l => l.length > 0)
      .join(' ');
    return cleaned || null;
  }

  // 匹配行内注释格式: // @intent: ... 或 # @intent: ...
  const lineMatch = content.match(/@intent[:\s]+(.+)/);
  return lineMatch?.[1]?.trim() ?? null;
}

/**
 * 判断文件是否应该被排除（不扫描、不投射）
 * 默认排除：所有点开头文件/目录、node_modules
 * 可叠加用户配置的 glob 模式
 */
function isExcluded(relPath: string, extraPatterns?: string[]): boolean {
  const parts = relPath.split(/[\/\\]/);
  // 内置硬编码排除
  if (parts.some(p => p.startsWith('.') || p === 'node_modules')) {
    return true;
  }
  // 用户额外排除模式
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
   * 全量扫描 sourceRoot，重建整套 .cdd/intents/ 投射文件。
   * 输入：sourceRoot - 项目根目录绝对路径
   * 输出：FullSyncResult - 创建/更新/删除了多少投射文件
   * 副作用：写文件系统，清空 .cdd/intents/ 下过时的投射
   */
  async fullSync(input: FullSyncInput): Promise<FullSyncResult> {
    const { sourceRoot, excludePatterns } = input;
    const outputRoot = path.join(sourceRoot, '.cdd', 'intents');
    const result: FullSyncResult = { filesCreated: 0, filesUpdated: 0, filesDeleted: 0, indexesUpdated: 0 };

    // 1. 扫描所有源文件
    const allFiles = await this.fileRepo.scanDirectory(sourceRoot, { recursive: true });

    // 2. 处理每个文件，收集目录索引数据
    const dirMap = new Map<string, DirIndex>();

    for (const absPath of allFiles) {
      const relPath = path.relative(sourceRoot, absPath);
      if (isExcluded(relPath, excludePatterns)) continue;

      const content = await this.fileRepo.readFile(absPath);
      const intent = extractIntent(content);
      const relDir = path.dirname(relPath);
      const fileName = path.basename(relPath);

      // 提取文件投射路径: .cdd/intents/<relPath>.md
      const projPath = path.join(outputRoot, relPath) + '.md';

      if (intent) {
        // 写投射文件
        const projContent = this.buildProjectionContent(relPath, intent);
        const exists = await this.fileRepo.exists(projPath);
        await this.fileRepo.writeFile(projPath, projContent);
        if (exists) result.filesUpdated++;
        else result.filesCreated++;

        // 记录到目录索引
        this.recordFileInDir(dirMap, relDir, fileName, intent);
      } else {
        // 清除过时的投射文件
        if (await this.fileRepo.exists(projPath)) {
          await this.fileRepo.deleteFile(projPath);
          result.filesDeleted++;
        }
      }
    }

    // 3. 生成/更新每个目录的 _index.md
    const dirsToProcess = this.collectAllDirsWithFiles(dirMap, allFiles, sourceRoot);
    for (const dirRelPath of dirsToProcess) {
      const indexData = dirMap.get(dirRelPath);
      const indexContent = this.buildIndexContent(dirRelPath, indexData || { files: [], subdirs: [] });
      const indexPath = path.join(outputRoot, dirRelPath, '_index.md');
      await this.fileRepo.ensureDir(path.join(outputRoot, dirRelPath));
      await this.fileRepo.writeFile(indexPath, indexContent);
      result.indexesUpdated++;
    }

    // 4. 清除过时的 _index.md（目录不再有文件时）
    await this.cleanupStaleIndexes(outputRoot, dirsToProcess);

    return result;
  }

  // ==================== 单文件增量同步 ====================

  /**
   * @contract
   * 单个源文件变更后，更新对应的投射文件 + 父目录 _index.md。
   * 输入：sourceRoot + filePath（源文件绝对路径）
   * 输出：SyncFileResult
   */
  async syncFile(input: SyncFileInput): Promise<SyncFileResult> {
    const { sourceRoot, filePath, excludePatterns } = input;
    const relPath = path.relative(sourceRoot, filePath);
    if (!relPath || relPath.startsWith('..') || isExcluded(relPath, excludePatterns)) {
      return { projectionWritten: false, indexUpdated: false };
    }

    const outputRoot = path.join(sourceRoot, '.cdd', 'intents');
    const projPath = path.join(outputRoot, relPath) + '.md';
    const relDir = path.dirname(relPath);

    // 读源文件，提取 intent
    const content = await this.fileRepo.readFile(filePath);
    const intent = extractIntent(content);

    if (intent) {
      // 写/更新投射文件
      const projContent = this.buildProjectionContent(relPath, intent);
      await this.fileRepo.ensureDir(path.dirname(projPath));
      await this.fileRepo.writeFile(projPath, projContent);
    } else {
      // 清除过时的投射
      if (await this.fileRepo.exists(projPath)) {
        await this.fileRepo.deleteFile(projPath);
      }
    }

    // 更新父目录 _index.md
    await this.updateDirIndex(sourceRoot, relDir);

    return {
      projectionWritten: !!intent,
      indexUpdated: true,
    };
  }

  /**
   * @contract
   * 源文件被删除后，清除对应的投射文件 + 更新父目录 _index.md。
   * 输入：sourceRoot + filePath（被删源文件绝对路径）
   * 输出：RemoveFileResult
   */
  async removeFile(input: RemoveFileInput): Promise<RemoveFileResult> {
    const { sourceRoot, filePath, excludePatterns } = input;
    const relPath = path.relative(sourceRoot, filePath);
    if (!relPath || relPath.startsWith('..') || isExcluded(relPath, excludePatterns)) {
      return { projectionDeleted: false, indexUpdated: false };
    }

    const outputRoot = path.join(sourceRoot, '.cdd', 'intents');
    const projPath = path.join(outputRoot, relPath) + '.md';

    let deleted = false;
    if (await this.fileRepo.exists(projPath)) {
      await this.fileRepo.deleteFile(projPath);
      deleted = true;
    }

    // 更新父目录 _index.md
    const relDir = path.dirname(relPath);
    await this.updateDirIndex(sourceRoot, relDir);

    return { projectionDeleted: deleted, indexUpdated: true };
  }

  // ==================== 内部方法 ====================

  /** 构建单个文件的投射内容 */
  private buildProjectionContent(relPath: string, intent: string): string {
    const fileName = path.basename(relPath);
    // 标准化路径分隔符为 posix 风格
    const normPath = relPath.replace(/\\/g, '/');
    return `# ${fileName}\n\n\`${normPath}\`\n\n**intent:** ${intent}\n`;
  }

  /** 构建目录索引内容 */
  private buildIndexContent(dirRelPath: string, data: DirIndex): string {
    const lines: string[] = [];
    const dirName = dirRelPath === '.' ? '' : dirRelPath.replace(/\\/g, '/');
    const title = dirName || '项目根目录';
    lines.push(`# ${title}/`, '');

    if (data.files.length > 0) {
      lines.push('## Files', '');
      for (const f of data.files) {
        lines.push(`- **${f.fileName}** — ${f.intent}`);
      }
      lines.push('');
    }

    if (data.subdirs.length > 0) {
      lines.push('## Subdirectories', '');
      for (const d of data.subdirs.sort()) {
        lines.push(`- ${d}/`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  /** 在目录索引中记录一个文件 */
  private recordFileInDir(
    dirMap: Map<string, DirIndex>,
    dirRelPath: string,
    fileName: string,
    intent: string
  ): void {
    if (!dirMap.has(dirRelPath)) {
      dirMap.set(dirRelPath, { files: [], subdirs: [] });
    }
    const entry = dirMap.get(dirRelPath)!;
    entry.files.push({ fileName, intent });
  }

  /** 收集所有需要生成 _index.md 的目录路径（含空目录但需保留子目录索引的） */
  private collectAllDirsWithFiles(
    dirMap: Map<string, DirIndex>,
    allFiles: string[],
    sourceRoot: string
  ): string[] {
    const dirSet = new Set<string>();

    // 从有文件记录的目录开始
    for (const dir of dirMap.keys()) {
      dirSet.add(dir);
      // 添加所有祖先目录
      let parent = path.dirname(dir);
      while (parent !== '.' && parent !== dir) {
        dirSet.add(parent);
        parent = path.dirname(parent);
      }
      dirSet.add('.');
    }

    // 补充分子目录信息：对有记录的目录，找到它的直接子目录
    for (const dir of dirSet) {
      const entry = dirMap.get(dir) || { files: [], subdirs: [] };
      // 找出哪些子目录在 dirSet 中是直接的下一级
      for (const other of dirSet) {
        if (other === dir) continue;
        const parentOfOther = path.dirname(other);
        if (parentOfOther === dir) {
          const subdirName = path.basename(other);
          if (!entry.subdirs.includes(subdirName)) {
            entry.subdirs.push(subdirName);
          }
        }
      }
      dirMap.set(dir, entry);
    }

    return Array.from(dirSet).sort((a, b) => {
      if (a === '.') return -1;
      if (b === '.') return 1;
      return a.localeCompare(b);
    });
  }

  /** 更新单个目录的 _index.md */
  private async updateDirIndex(sourceRoot: string, dirRelPath: string): Promise<void> {
    const absDir = path.join(sourceRoot, dirRelPath);
    const outputRoot = path.join(sourceRoot, '.cdd', 'intents');
    const indexPath = path.join(outputRoot, dirRelPath, '_index.md');

    // 重新扫描该目录下所有文件的 intent
    const fileNames = await this.fileRepo.scanDirectory(absDir, { recursive: false });
    const files: FileEntry[] = [];
    const subdirs = await this.fileRepo.listSubdirectories(absDir);

    for (const absPath of fileNames) {
      const relPath = path.relative(absDir, absPath);
      try {
        const content = await this.fileRepo.readFile(absPath);
        const intent = extractIntent(content);
        if (intent) {
          files.push({ fileName: relPath, intent });
        }
      } catch {
        // 跳过读取失败的文件
      }
    }

    if (files.length === 0 && subdirs.length === 0) {
      // 目录既无有 intent 的文件也无子目录，删掉 _index.md
      if (await this.fileRepo.exists(indexPath)) {
        await this.fileRepo.deleteFile(indexPath);
      }
      const projDir = path.join(outputRoot, dirRelPath);
      const remainingFiles = await this.fileRepo.scanDirectory(projDir, { recursive: false });
      if (remainingFiles.length === 0) {
        // 目录空，不做额外清理
      }
      return;
    }

    // 写入 _index.md
    const indexContent = this.buildIndexContent(dirRelPath, { files, subdirs });
    await this.fileRepo.ensureDir(path.dirname(indexPath));
    await this.fileRepo.writeFile(indexPath, indexContent);
  }

  /** 清除不再需要的 _index.md */
  private async cleanupStaleIndexes(
    outputRoot: string,
    activeDirs: string[]
  ): Promise<void> {
    const activeSet = new Set(activeDirs);
    // 扫描 .cdd/intents/ 下所有 _index.md
    const allIndexFiles = await this.fileRepo.scanDirectory(outputRoot, { recursive: true });
    for (const absPath of allIndexFiles) {
      const fileName = path.basename(absPath);
      if (fileName !== '_index.md') continue;
      const relDir = path.relative(outputRoot, path.dirname(absPath)) || '.';
      if (!activeSet.has(relDir)) {
        await this.fileRepo.deleteFile(absPath);
      }
    }
  }
}
