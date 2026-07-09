import * as fs from 'fs';
import * as path from 'path';
import { IFileRepository } from '../../repositories/IFileRepository';

// @intent: IFileRepository 的 Node.js fs 实现层。
// 屏蔽：scanDirectory 自动跳过 .git/node_modules；watchFile 防重复注册；writeFile 自动创建父目录

export class FileSystemRepository implements IFileRepository {
  private watchers: Map<string, fs.FSWatcher> = new Map();

  // @contract: readFile(filePath: string) => Promise<string>
  // @step: [读取文件] 使用 fs.promises.readFile 读取文件内容
  // @step: [返回内容] 返回 UTF-8 编码的文件内容
  // @boundary: 文件不存在时抛出错误
  async readFile(filePath: string): Promise<string> {
    try {
      return await fs.promises.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error}`);
    }
  }

  // @contract: exists(filePath: string) => Promise<boolean>
  // @step: [检查文件] 使用 fs.promises.access 检查文件是否存在
  // @step: [返回结果] 存在返回 true，不存在返回 false
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // @contract: getModifiedTime(filePath: string) => Promise<number>
  // @step: [获取文件状态] 使用 fs.promises.stat 获取文件状态
  // @step: [返回修改时间] 返回修改时间的毫秒时间戳
  // @boundary: 文件不存在时抛出错误
  async getModifiedTime(filePath: string): Promise<number> {
    try {
      const stats = await fs.promises.stat(filePath);
      return stats.mtimeMs;
    } catch (error) {
      throw new Error(`Failed to get modified time for ${filePath}: ${error}`);
    }
  }

  // @contract: watchFile(filePath: string, callback: (filePath: string) => void) => void
  // @step: [创建监听器] 使用 fs.watch 创建文件监听器
  // @step: [注册回调] 文件变化时调用回调函数
  // @step: [存储监听器] 将监听器存储到 Map 中
  watchFile(filePath: string, callback: (filePath: string) => void): void {
    if (this.watchers.has(filePath)) {
      return;
    }

    const watcher = fs.watch(filePath, (eventType) => {
      if (eventType === 'change') {
        callback(filePath);
      }
    });

    this.watchers.set(filePath, watcher);
  }

  // @contract: unwatchFile(filePath: string) => void
  // @step: [获取监听器] 从 Map 中获取监听器
  // @step: [关闭监听器] 调用 watcher.close() 关闭监听
  // @step: [删除记录] 从 Map 中删除监听器
  unwatchFile(filePath: string): void {
    const watcher = this.watchers.get(filePath);
    if (watcher) {
      watcher.close();
      this.watchers.delete(filePath);
    }
  }

  // @contract: writeFile(filePath: string, content: string) => Promise<void>
  // @step: [确保目录] 确保文件父目录存在
  // @step: [写入文件] 使用 fs.promises.writeFile 写入文件内容
  // @boundary: 写入失败时抛出错误
  async writeFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    await this.ensureDir(dir);
    await fs.promises.writeFile(filePath, content, 'utf-8');
  }

  // @contract: ensureDir(dirPath: string) => Promise<void>
  // @step: [创建目录] 使用 fs.promises.mkdir 递归创建目录
  // @boundary: 目录已存在时不报错
  async ensureDir(dirPath: string): Promise<void> {
    await fs.promises.mkdir(dirPath, { recursive: true });
  }

  // @contract: scanDirectory(dirPath: string, options?) => Promise<string[]>
  // @step: [读取目录] 使用 fs.promises.readdir 读取目录条目
  // @step: [递归扫描] 对目录条目递归扫描（如果 recursive 为 true）
  // @step: [过滤文件] 按扩展名过滤文件
  // @step: [返回结果] 返回匹配的文件路径数组
  // @boundary: 目录不存在时返回空数组而非抛出异常
  async scanDirectory(
    dirPath: string,
    options?: {
      extensions?: string[];
      recursive?: boolean;
    }
  ): Promise<string[]> {
    const { extensions, recursive = true } = options || {};
    const results: string[] = [];

    const scan = async (currentPath: string): Promise<void> => {
      let entries;
      try {
        entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
      } catch {
        return; // 目录不存在或无权访问，跳过
      }

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          if (recursive && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scan(fullPath);
          }
        } else if (entry.isFile()) {
          if (!extensions || extensions.includes(path.extname(entry.name))) {
            results.push(fullPath);
          }
        }
      }
    };

    await scan(dirPath);
    return results;
  }

  // @contract: getLineCount(filePath: string) => Promise<number>
  // @step: [读取文件] 读取文件内容
  // @step: [分割行] 按换行符分割
  // @step: [返回行数] 返回行数
  // @boundary: 文件不存在时抛出错误
  async getLineCount(filePath: string): Promise<number> {
    const content = await this.readFile(filePath);
    return content.split('\n').length;
  }

  // @contract: deleteFile(filePath: string) => Promise<void>
  // @step: [删除文件] 使用 fs.promises.unlink 删除文件
  // @boundary: 文件不存在时静默成功（不抛错）
  async deleteFile(filePath: string): Promise<void> {
    try {
      await fs.promises.unlink(filePath);
    } catch (err: any) {
      if (err?.code !== 'ENOENT') throw err;
    }
  }

  // @contract: listSubdirectories(dirPath: string) => Promise<string[]>
  // @step: [读取目录] 使用 fs.promises.readdir 读取目录条目
  // @step: [过滤目录] 只保留 isDirectory() 为 true 的条目
  // @step: [排除隐藏] 排除以 . 开头的目录
  // @step: [排除 node_modules] 排除 node_modules
  // @step: [返回] 返回目录名数组
  // @boundary: 目录不存在时返回空数组
  async listSubdirectories(dirPath: string): Promise<string[]> {
    try {
      const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter(e => e.isDirectory() && !e.name.startsWith('.') && e.name !== 'node_modules')
        .map(e => e.name);
    } catch {
      return [];
    }
  }
}
