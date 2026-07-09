import * as fs from 'fs';

// @intent: 缓存文件内容，避免重复读取文件

// @entity: CacheEntry
// 缓存条目
interface CacheEntry {
  content: string;
  timestamp: number;
  size: number;
}

// @contract: FileContentCache.get(filePath: string) => Promise<string>
// @step: [检查缓存] 检查缓存中是否存在该文件
// @step: [验证时效] 检查文件是否被修改（比较时间戳）
// @step: [返回缓存] 如果缓存有效，返回缓存内容
// @step: [读取文件] 如果缓存无效，读取文件并更新缓存
// @step: [返回内容] 返回文件内容
// @boundary: 当文件不存在时，抛出错误
// @boundary: 当文件被修改时，自动更新缓存
export class FileContentCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private currentSize: number = 0;

  constructor(maxSizeMB: number = 50) {
    this.maxSize = maxSizeMB * 1024 * 1024; // 转换为字节
  }

  // @contract: get(filePath: string) => Promise<string>
  // @step: [检查缓存] 检查缓存中是否存在该文件
  // @step: [验证时效] 检查文件是否被修改
  // @step: [返回缓存] 如果缓存有效，返回缓存内容
  // @step: [读取文件] 如果缓存无效，读取文件并更新缓存
  // @step: [返回内容] 返回文件内容
  async get(filePath: string): Promise<string> {
    const cached = this.cache.get(filePath);

    if (cached) {
      // 检查文件是否被修改
      try {
        const stats = await fs.promises.stat(filePath);
        const fileModifiedTime = stats.mtimeMs;

        if (fileModifiedTime <= cached.timestamp) {
          // 缓存有效
          console.log(`[FileContentCache] 缓存命中: ${filePath}`);
          return cached.content;
        } else {
          // 文件已修改，删除旧缓存
          console.log(`[FileContentCache] 文件已修改，更新缓存: ${filePath}`);
          this.delete(filePath);
        }
      } catch (error) {
        // 文件不存在，删除缓存
        this.delete(filePath);
      }
    }

    // 读取文件并缓存
    console.log(`[FileContentCache] 缓存未命中，读取文件: ${filePath}`);
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const stats = await fs.promises.stat(filePath);

    this.set(filePath, content, stats.mtimeMs);
    return content;
  }
  // @end

  // @contract: set(filePath: string, content: string, timestamp: number) => void
  // @step: [检查容量] 检查是否超过最大缓存大小
  // @step: [清理缓存] 如果超过，使用 LRU 策略清理
  // @step: [存储缓存] 存储文件内容到缓存
  // @step: [更新大小] 更新当前缓存大小
  private set(filePath: string, content: string, timestamp: number): void {
    const size = Buffer.byteLength(content, 'utf-8');

    // 检查是否需要清理缓存
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      this.evictOldest();
    }

    this.cache.set(filePath, {
      content,
      timestamp,
      size
    });

    this.currentSize += size;
  }
  // @end

  // @contract: delete(filePath: string) => void
  // @step: [检查存在] 检查缓存中是否存在该文件
  // @step: [删除缓存] 删除缓存条目
  // @step: [更新大小] 更新当前缓存大小
  delete(filePath: string): void {
    const cached = this.cache.get(filePath);
    if (cached) {
      this.cache.delete(filePath);
      this.currentSize -= cached.size;
      console.log(`[FileContentCache] 删除缓存: ${filePath}`);
    }
  }
  // @end

  // @contract: clear() => void
  // @step: [清空缓存] 清空所有缓存
  // @step: [重置大小] 重置当前缓存大小
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
    console.log(`[FileContentCache] 清空所有缓存`);
  }
  // @end

  // @contract: evictOldest() => void
  // @step: [找到最旧] 找到时间戳最旧的缓存条目
  // @step: [删除] 删除该条目
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
      console.log(`[FileContentCache] LRU 淘汰: ${oldestKey}`);
    }
  }
  // @end

  // @contract: getCurrentSize() => number
  // @step: [返回当前大小] 返回当前缓存大小（字节）
  getCurrentSize(): number {
    return this.currentSize;
  }
  // @end

  // @contract: getEntryCount() => number
  // @step: [返回条目数] 返回缓存条目数量
  getEntryCount(): number {
    return this.cache.size;
  }
  // @end

  // @contract: getMaxSize() => number
  // @step: [返回最大容量] 返回最大缓存大小（字节）
  getMaxSize(): number {
    return this.maxSize;
  }
  // @end

  // @contract: getStats() => { size: number, count: number, maxSize: number }
  // @step: [返回统计] 返回缓存统计信息
  getStats(): { size: number; count: number; maxSize: number } {
    return {
      size: this.currentSize,
      count: this.cache.size,
      maxSize: this.maxSize
    };
  }
  // @end
}
