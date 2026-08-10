/**
 * @intent
 * 缓存函数和类型定义，避免重复搜索。调试日志经 console.error 输出到 stderr，不写 stdout（MCP stdio 协议要求）。
 * 验收条件：
 * - 日志全部走 stderr（console.error），stdout 零输出
 */

interface DefinitionCacheEntry {
  definition: any;
  timestamp: number;
  filePath: string;
}

// @contract: DefinitionCache.getFunction(functionName: string, filePath: string) => any | null
// @step: [生成缓存键] 使用函数名和文件路径生成缓存键
// @step: [检查缓存] 检查缓存中是否存在该函数定义
// @step: [返回缓存] 如果缓存有效，返回缓存的定义
// @step: [返回 null] 如果缓存不存在，返回 null
// @boundary: 当缓存不存在时，返回 null
export class DefinitionCache {
  private functionCache = new Map<string, DefinitionCacheEntry>();
  private typeCache = new Map<string, DefinitionCacheEntry>();
  private maxEntries: number;

  constructor(maxEntries: number = 500) {
    this.maxEntries = maxEntries;
  }

  // @contract: getFunction(functionName: string, filePath: string) => any | null
  // @step: [生成缓存键] 使用函数名和文件路径生成缓存键
  // @step: [检查缓存] 检查缓存中是否存在该函数定义
  // @step: [返回缓存] 如果缓存有效，返回缓存的定义
  getFunction(functionName: string, filePath: string): any | null {
    const cacheKey = this.getCacheKey(functionName, filePath);
    const cached = this.functionCache.get(cacheKey);

    if (cached) {
      console.error(`[DefinitionCache] 函数缓存命中: ${cacheKey}`);
      return cached.definition;
    }

    return null;
  }
  // @end

  // @contract: setFunction(functionName: string, filePath: string, definition: any) => void
  // @step: [检查容量] 检查是否超过最大条目数
  // @step: [清理缓存] 如果超过，删除最旧的条目
  // @step: [存储缓存] 存储函数定义到缓存
  setFunction(functionName: string, filePath: string, definition: any): void {
    if (this.functionCache.size >= this.maxEntries) {
      this.evictOldestFunction();
    }

    const cacheKey = this.getCacheKey(functionName, filePath);
    this.functionCache.set(cacheKey, {
      definition,
      timestamp: Date.now(),
      filePath
    });

    console.error(`[DefinitionCache] 缓存函数定义: ${cacheKey}`);
  }
  // @end

  // @contract: getType(typeName: string, filePath: string) => any | null
  // @step: [生成缓存键] 使用类型名和文件路径生成缓存键
  // @step: [检查缓存] 检查缓存中是否存在该类型定义
  // @step: [返回缓存] 如果缓存有效，返回缓存的定义
  getType(typeName: string, filePath: string): any | null {
    const cacheKey = this.getCacheKey(typeName, filePath);
    const cached = this.typeCache.get(cacheKey);

    if (cached) {
      console.error(`[DefinitionCache] 类型缓存命中: ${cacheKey}`);
      return cached.definition;
    }

    return null;
  }
  // @end

  // @contract: setType(typeName: string, filePath: string, definition: any) => void
  // @step: [检查容量] 检查是否超过最大条目数
  // @step: [清理缓存] 如果超过，删除最旧的条目
  // @step: [存储缓存] 存储类型定义到缓存
  setType(typeName: string, filePath: string, definition: any): void {
    if (this.typeCache.size >= this.maxEntries) {
      this.evictOldestType();
    }

    const cacheKey = this.getCacheKey(typeName, filePath);
    this.typeCache.set(cacheKey, {
      definition,
      timestamp: Date.now(),
      filePath
    });

    console.error(`[DefinitionCache] 缓存类型定义: ${cacheKey}`);
  }
  // @end

  // @contract: deleteByFile(filePath: string) => void
  // @step: [遍历函数缓存] 遍历所有函数缓存条目
  // @step: [匹配文件] 找到所有与该文件相关的缓存
  // @step: [删除] 删除这些缓存条目
  // @step: [遍历类型缓存] 遍历所有类型缓存条目
  // @step: [匹配文件] 找到所有与该文件相关的缓存
  // @step: [删除] 删除这些缓存条目
  deleteByFile(filePath: string): void {
    const functionKeysToDelete: string[] = [];
    const typeKeysToDelete: string[] = [];

    for (const [key, entry] of this.functionCache.entries()) {
      if (entry.filePath === filePath) {
        functionKeysToDelete.push(key);
      }
    }

    for (const [key, entry] of this.typeCache.entries()) {
      if (entry.filePath === filePath) {
        typeKeysToDelete.push(key);
      }
    }

    for (const key of functionKeysToDelete) {
      this.functionCache.delete(key);
      console.error(`[DefinitionCache] 删除函数缓存: ${key}`);
    }

    for (const key of typeKeysToDelete) {
      this.typeCache.delete(key);
      console.error(`[DefinitionCache] 删除类型缓存: ${key}`);
    }
  }
  // @end

  // @contract: clear() => void
  // @step: [清空函数缓存] 清空所有函数缓存
  // @step: [清空类型缓存] 清空所有类型缓存
  clear(): void {
    this.functionCache.clear();
    this.typeCache.clear();
    console.error(`[DefinitionCache] 清空所有缓存`);
  }
  // @end

  // @contract: getCacheKey(name: string, filePath: string) => string
  // @step: [生成键] 使用名称和文件路径生成唯一键
  private getCacheKey(name: string, filePath: string): string {
    return `${filePath}:${name}`;
  }
  // @end

  // @contract: evictOldestFunction() => void
  // @step: [找到最旧] 找到时间戳最旧的函数缓存条目
  // @step: [删除] 删除该条目
  private evictOldestFunction(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.functionCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.functionCache.delete(oldestKey);
      console.error(`[DefinitionCache] LRU 淘汰函数: ${oldestKey}`);
    }
  }
  // @end

  // @contract: evictOldestType() => void
  // @step: [找到最旧] 找到时间戳最旧的类型缓存条目
  // @step: [删除] 删除该条目
  private evictOldestType(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.typeCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.typeCache.delete(oldestKey);
      console.error(`[DefinitionCache] LRU 淘汰类型: ${oldestKey}`);
    }
  }
  // @end

  // @contract: deleteFunction(functionName: string, filePath: string) => void
  // @step: [生成缓存键] 使用函数名和文件路径生成缓存键
  // @step: [删除缓存] 从缓存中删除该函数定义
  deleteFunction(functionName: string, filePath: string): void {
    const cacheKey = this.getCacheKey(functionName, filePath);
    this.functionCache.delete(cacheKey);
  }
  // @end

  // @contract: deleteType(typeName: string, filePath: string) => void
  // @step: [生成缓存键] 使用类型名和文件路径生成缓存键
  // @step: [删除缓存] 从缓存中删除该类型定义
  deleteType(typeName: string, filePath: string): void {
    const cacheKey = this.getCacheKey(typeName, filePath);
    this.typeCache.delete(cacheKey);
  }
  // @end

  // @contract: getFunctionCount() => number
  // @step: [返回数量] 返回函数缓存数量
  getFunctionCount(): number {
    return this.functionCache.size;
  }
  // @end

  // @contract: getTypeCount() => number
  // @step: [返回数量] 返回类型缓存数量
  getTypeCount(): number {
    return this.typeCache.size;
  }
  // @end

  // @contract: getMaxSize() => number
  // @step: [返回最大容量] 返回最大条目数
  getMaxSize(): number {
    return this.maxEntries;
  }
  // @end

  // @contract: getStats() => { functionCount: number, typeCount: number, maxEntries: number }
  // @step: [返回统计] 返回缓存统计信息
  getStats(): { functionCount: number; typeCount: number; maxEntries: number } {
    return {
      functionCount: this.functionCache.size,
      typeCount: this.typeCache.size,
      maxEntries: this.maxEntries
    };
  }
  // @end
}
