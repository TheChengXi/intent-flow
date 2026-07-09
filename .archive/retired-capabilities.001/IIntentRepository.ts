/**
 * @intent Intent 数据仓库接口
 */

import { Intent } from '../entities/Intent';

export interface IIntentRepository {
  /**
   * 保存 Intent 列表
   *
   * @param intents 要保存的 Intent 数组
   *
   * 实现要点：
   * - 支持批量保存
   * - 如果 Intent 已存在则更新
   * - 保证 filePath 的唯一性
   */
  save(intents: Intent[]): Promise<void>;

  /**
   * 查询所有 Intent
   *
   * @returns 所有已保存的 Intent 数组
   */
  findAll(): Promise<Intent[]>;

  /**
   * 根据文件路径查询单个 Intent
   *
   * @param filePath 文件的绝对路径
   * @returns 找到的 Intent，未找到则返回 null
   */
  findByPath(filePath: string): Promise<Intent | null>;

  /**
   * 根据架构层级查询 Intent
   *
   * @param layer 层级名称（如 'data'、'application'、'adapter'）
   * @returns 该层级的所有 Intent 数组
   */
  findByLayer(layer: string): Promise<Intent[]>;

  /**
   * 删除指定路径的 Intent
   *
   * @param filePath 文件的绝对路径
   * @returns 删除成功时返回 true，未找到时返回 false
   */
  delete(filePath: string): Promise<boolean>;

  /**
   * 清空所有 Intent
   *
   * 实现要点：
   * - 谨慎使用，通常只在重新扫描时调用
   */
  clear(): Promise<void>;
}
