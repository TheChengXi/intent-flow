/**
 * @intent CallDependency 数据仓库接口
 */

import { CallDependency } from '../entities/CallDependency';

export interface ICallGraphRepository {
  /**
   * 保存调用依赖关系
   *
   * @param dependencies 要保存的 CallDependency 数组
   *
   * 实现要点：
   * - 支持批量保存
   * - 如果依赖关系已存在则更新
   * - 保证 from 路径的唯一性（一个文件只有一条调用关系记录）
   */
  save(dependencies: CallDependency[]): Promise<void>;

  /**
   * 查询文件的所有依赖
   *
   * @param filePath 文件的绝对路径
   * @returns 该文件的 CallDependency，未找到则返回 null
   */
  findDependencies(filePath: string): Promise<CallDependency | null>;

  /**
   * 查询所有调用关系
   *
   * @returns 所有已保存的 CallDependency 数组
   */
  findAll(): Promise<CallDependency[]>;

  /**
   * 删除文件的调用信息
   *
   * @param filePath 文件的绝对路径
   * @returns 删除成功时返回 true，未找到时返回 false
   */
  delete(filePath: string): Promise<boolean>;

  /**
   * 清空所有调用关系
   *
   * 实现要点：
   * - 谨慎使用，通常只在重新分析时调用
   */
  clear(): Promise<void>;
}
