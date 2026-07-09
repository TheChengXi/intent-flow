import { ICacheRepository } from '../../repositories/ICacheRepository';
import { CacheStats, CacheTypeStats, DefinitionCacheStats } from '../../entities/CacheStats';
import { FileContentCache } from './FileContentCache';
import { ASTCache } from './ASTCache';
import { DefinitionCache } from './DefinitionCache';

/**
 * @intent
 * 唯一的缓存门面。实现 ICacheRepository 供 use case 通过 DI 使用，
 * 同时提供便捷方法供 searchers/extractors 通过静态 getInstance() 访问。
 * 屏蔽：键格式 "type:identifier" 的路由分发逻辑；三种缓存各自的 TTL 和容量策略差异
 */

export class CacheRepositoryImpl implements ICacheRepository {
  private static instance: CacheRepositoryImpl;

  private fileContentCache: FileContentCache;
  private astCache: ASTCache;
  private definitionCache: DefinitionCache;

  private constructor(
    fileContentCacheMaxSizeMB: number = 50,
    astCacheMaxEntries: number = 100,
    definitionCacheMaxEntries: number = 500
  ) {
    this.fileContentCache = new FileContentCache(fileContentCacheMaxSizeMB);
    this.astCache = new ASTCache(astCacheMaxEntries);
    this.definitionCache = new DefinitionCache(definitionCacheMaxEntries);
  }

  /** 获取全局单例。第一次调用时按默认参数初始化。 */
  static getInstance(): CacheRepositoryImpl {
    if (!CacheRepositoryImpl.instance) {
      CacheRepositoryImpl.instance = new CacheRepositoryImpl();
    }
    return CacheRepositoryImpl.instance;
  }

  // ==================== ICacheRepository 接口实现 ====================

  // @contract: get<T>(key: string) => Promise<T | null>
  async get<T>(key: string): Promise<T | null> {
    const [type, ...rest] = key.split(':');
    const identifier = rest.join(':');

    switch (type) {
      case 'file':
        try {
          const content = await this.fileContentCache.get(identifier);
          return content as T;
        } catch {
          return null;
        }
      case 'ast':
        return this.astCache.getFromCache(identifier) as T;
      case 'func':
        const [funcName, filePath] = identifier.split(':');
        return this.definitionCache.getFunction(funcName, filePath) as T;
      case 'type':
        const [typeName, typeFilePath] = identifier.split(':');
        return this.definitionCache.getType(typeName, typeFilePath) as T;
      default:
        return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    const [type, ...rest] = key.split(':');
    const identifier = rest.join(':');

    switch (type) {
      case 'file':
        break;
      case 'ast':
        break;
      case 'func':
        const [funcName, filePath] = identifier.split(':');
        this.definitionCache.setFunction(funcName, filePath, value);
        break;
      case 'type':
        const [typeName, typeFilePath] = identifier.split(':');
        this.definitionCache.setType(typeName, typeFilePath, value);
        break;
    }
  }

  async delete(key: string): Promise<void> {
    const [type, ...rest] = key.split(':');
    const identifier = rest.join(':');

    switch (type) {
      case 'file':
        this.fileContentCache.delete(identifier);
        break;
      case 'ast':
        this.astCache.delete(identifier);
        break;
      case 'func':
        const [funcName, filePath] = identifier.split(':');
        this.definitionCache.deleteFunction(funcName, filePath);
        break;
      case 'type':
        const [typeName, typeFilePath] = identifier.split(':');
        this.definitionCache.deleteType(typeName, typeFilePath);
        break;
    }
  }

  async has(key: string): Promise<boolean> {
    const value = await this.get(key);
    return value !== null;
  }

  async clear(): Promise<void> {
    this.fileContentCache.clear();
    this.astCache.clear();
    this.definitionCache.clear();
  }

  async getStats(): Promise<CacheStats> {
    const fileContentStats: CacheTypeStats = {
      size: this.fileContentCache.getCurrentSize(),
      count: this.fileContentCache.getEntryCount(),
      maxCapacity: this.fileContentCache.getMaxSize()
    };

    const astStats: CacheTypeStats = {
      size: 0,
      count: this.astCache.getSize(),
      maxCapacity: this.astCache.getMaxSize()
    };

    const definitionStats: DefinitionCacheStats = {
      functionCount: this.definitionCache.getFunctionCount(),
      typeCount: this.definitionCache.getTypeCount(),
      maxCapacity: this.definitionCache.getMaxSize()
    };

    return {
      fileContent: fileContentStats,
      ast: astStats,
      definition: definitionStats
    };
  }

  async invalidateFile(filePath: string): Promise<void> {
    this.fileContentCache.delete(filePath);
  }

  async invalidateAST(filePath: string): Promise<void> {
    this.astCache.delete(filePath);
  }

  async invalidateDefinitions(filePath: string): Promise<void> {
    this.definitionCache.deleteByFile(filePath);
  }

  // ==================== 便捷方法（供 searchers 静态调用） ====================

  /** 读取文件内容（缓存自动管理：命中返回，未命中读取+缓存） */
  async getFileContent(filePath: string): Promise<string> {
    return this.fileContentCache.get(filePath);
  }

  /** 查询缓存的函数定义 */
  getFunction(functionName: string, filePath: string): any | null {
    return this.definitionCache.getFunction(functionName, filePath);
  }

  /** 缓存函数定义 */
  setFunction(functionName: string, filePath: string, definition: any): void {
    this.definitionCache.setFunction(functionName, filePath, definition);
  }

  /** 查询缓存的类型定义 */
  getType(typeName: string, filePath: string): any | null {
    return this.definitionCache.getType(typeName, filePath);
  }

  /** 缓存类型定义 */
  setType(typeName: string, filePath: string, definition: any): void {
    this.definitionCache.setType(typeName, filePath, definition);
  }
}
