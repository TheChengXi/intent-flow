import { TreeSitterManager } from '../tree-sitter/TreeSitterManager';

// @intent: 缓存 Tree-sitter 解析的 AST，避免重复解析

// @entity: ASTCacheEntry
// AST 缓存条目
interface ASTCacheEntry {
  ast: any;
  timestamp: number;
}

// @contract: ASTCache.get(filePath: string, content: string, language: string) => Promise<any>
// @step: [生成缓存键] 使用文件路径和语言生成缓存键
// @step: [检查缓存] 检查缓存中是否存在该 AST
// @step: [返回缓存] 如果缓存有效，返回缓存的 AST
// @step: [解析 AST] 如果缓存无效，使用 Tree-sitter 解析并缓存
// @step: [返回 AST] 返回 AST
// @boundary: 当语言不支持时，返回 null
// @boundary: 当解析失败时，返回 null
export class ASTCache {
  private cache = new Map<string, ASTCacheEntry>();
  private maxEntries: number;

  constructor(maxEntries: number = 100) {
    this.maxEntries = maxEntries;
  }

  // @contract: get(filePath: string, content: string, language: string) => Promise<any>
  // @step: [生成缓存键] 使用文件路径和语言生成缓存键
  // @step: [检查缓存] 检查缓存中是否存在该 AST
  // @step: [返回缓存] 如果缓存有效，返回缓存的 AST
  // @step: [解析 AST] 如果缓存无效，使用 Tree-sitter 解析并缓存
  // @step: [返回 AST] 返回 AST
  async get(filePath: string, content: string, language: string): Promise<any> {
    const cacheKey = this.getCacheKey(filePath, language);
    const cached = this.cache.get(cacheKey);

    if (cached) {
      console.log(`[ASTCache] 缓存命中: ${cacheKey}`);
      return cached.ast;
    }

    // 解析 AST
    console.log(`[ASTCache] 缓存未命中，解析 AST: ${cacheKey}`);
    const ast = await this.parseAST(content, language);

    if (ast) {
      this.set(cacheKey, ast);
    }

    return ast;
  }
  // @end

  // @contract: parseAST(content: string, language: string) => Promise<any>
  // @step: [初始化] 初始化 Tree-sitter
  // @step: [获取语言] 获取对应语言的 Language
  // @step: [解析] 使用 Tree-sitter 解析代码
  // @step: [返回] 返回 AST 或 null
  private async parseAST(content: string, language: string): Promise<any> {
    try {
      await TreeSitterManager.init();

      const lang = await TreeSitterManager.getLanguage(language);
      if (!lang) {
        console.warn(`[ASTCache] Tree-sitter 不支持该语言: ${language}`);
        return null;
      }

      const parser = await TreeSitterManager.getParser();
      parser.setLanguage(lang);
      const tree = parser.parse(content);

      return tree;
    } catch (error) {
      console.warn(`[ASTCache] 解析 AST 失败:`, error);
      return null;
    }
  }
  // @end

  // @contract: set(cacheKey: string, ast: any) => void
  // @step: [检查容量] 检查是否超过最大条目数
  // @step: [清理缓存] 如果超过，删除最旧的条目
  // @step: [存储缓存] 存储 AST 到缓存
  private set(cacheKey: string, ast: any): void {
    // 检查是否需要清理缓存
    if (this.cache.size >= this.maxEntries) {
      this.evictOldest();
    }

    this.cache.set(cacheKey, {
      ast,
      timestamp: Date.now()
    });
  }
  // @end

  // @contract: delete(filePath: string) => void
  // @step: [遍历缓存] 遍历所有缓存条目
  // @step: [匹配文件] 找到所有与该文件相关的缓存
  // @step: [删除] 删除这些缓存条目
  delete(filePath: string): void {
    const keysToDelete: string[] = [];

    for (const key of this.cache.keys()) {
      if (key.startsWith(filePath + ':')) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
      console.log(`[ASTCache] 删除缓存: ${key}`);
    }
  }
  // @end

  // @contract: clear() => void
  // @step: [清空缓存] 清空所有缓存
  clear(): void {
    this.cache.clear();
    console.log(`[ASTCache] 清空所有缓存`);
  }
  // @end

  // @contract: getCacheKey(filePath: string, language: string) => string
  // @step: [生成键] 使用文件路径和语言生成唯一键
  private getCacheKey(filePath: string, language: string): string {
    return `${filePath}:${language}`;
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
      this.cache.delete(oldestKey);
      console.log(`[ASTCache] LRU 淘汰: ${oldestKey}`);
    }
  }
  // @end

  // @contract: getFromCache(filePath: string) => any | null
  // @step: [遍历缓存] 遍历所有缓存条目
  // @step: [匹配文件] 找到与该文件相关的缓存
  // @step: [返回] 返回 AST 或 null
  getFromCache(filePath: string): any | null {
    for (const [key, entry] of this.cache.entries()) {
      if (key.startsWith(filePath + ':')) {
        return entry.ast;
      }
    }
    return null;
  }
  // @end

  // @contract: getSize() => number
  // @step: [返回大小] 返回缓存条目数量
  getSize(): number {
    return this.cache.size;
  }
  // @end

  // @contract: getMaxSize() => number
  // @step: [返回最大容量] 返回最大条目数
  getMaxSize(): number {
    return this.maxEntries;
  }
  // @end

  // @contract: getStats() => { count: number, maxEntries: number }
  // @step: [返回统计] 返回缓存统计信息
  getStats(): { count: number; maxEntries: number } {
    return {
      count: this.cache.size,
      maxEntries: this.maxEntries
    };
  }
  // @end
}
