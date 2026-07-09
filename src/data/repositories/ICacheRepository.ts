import { CacheStats } from '../entities/CacheStats';

/**
 * @intent
 * 缓存抽象的统一边界，避免各层独立缓存导致数据不一致与内存浪费。
 * 屏蔽：三种缓存（文件内容/AST/定义）的统一键路由策略
 */

export interface ICacheRepository {
  /**
   * 获取缓存值
   * @param key 缓存键
   * @returns 缓存值（如果存在）
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * 设置缓存值
   * @param key 缓存键
   * @param value 缓存值
   * @param ttl 过期时间（毫秒），可选
   */
  set<T>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * 删除缓存
   * @param key 缓存键
   */
  delete(key: string): Promise<void>;

  /**
   * 检查缓存是否存在
   * @param key 缓存键
   * @returns 是否存在
   */
  has(key: string): Promise<boolean>;

  /**
   * 清空所有缓存
   */
  clear(): Promise<void>;

  /**
   * 获取缓存统计信息
   * @returns 缓存统计
   */
  getStats(): Promise<CacheStats>;

  /**
   * 使文件相关的缓存失效
   * @param filePath 文件路径
   */
  invalidateFile(filePath: string): Promise<void>;

  /**
   * 使 AST 缓存失效
   * @param filePath 文件路径
   */
  invalidateAST(filePath: string): Promise<void>;

  /**
   * 使定义缓存失效
   * @param filePath 文件路径
   */
  invalidateDefinitions(filePath: string): Promise<void>;
}
