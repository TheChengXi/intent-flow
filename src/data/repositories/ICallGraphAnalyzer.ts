/**
 * @intent 文件调用关系分析服务接口
 */

import { CallDependency } from '../entities/CallDependency';

export interface ICallGraphAnalyzer {
  /**
   * 分析单个文件的依赖关系
   *
   * @param filePath 文件的绝对路径
   * @returns CallDependency 对象（该文件导入的所有其他文件）
   * @throws 如果文件不存在或无法解析则抛出错误
   *
   * 实现要点：
   * - 使用 AST 解析提取 import/require 语句
   * - 处理相对路径转换为绝对路径
   * - 支持 'import ... from' 和 'require()' 两种形式
   * - 结果缓存，文件未修改时直接返回缓存
   * - 文件修改时缓存失效
   */
  analyzeFile(filePath: string): Promise<CallDependency>;

  /**
   * 分析整个目录的调用关系图
   *
   * @param dirPath 目录的绝对路径
   * @param recursive 是否递归扫描子目录（默认 true）
   * @returns Map，key 为文件路径，value 为该文件的 CallDependency
   *
   * 实现要点：
   * - 遍历目录找到所有源文件
   * - 对每个文件调用 analyzeFile()
   * - 汇总结果到 Map
   * - 只包含有导入的文件（没有导入任何文件的文件不需要包含）
   */
  analyzeDirectory(
    dirPath: string,
    recursive?: boolean
  ): Promise<Map<string, CallDependency>>;

  /**
   * 查找特定文件的所有"被调用者"（反向查询）
   *
   * @param filePath 目标文件的绝对路径
   * @param dirPath 搜索范围的目录路径
   * @returns 所有调用该文件的文件路径数组
   *
   * 实现要点：
   * - 从 dirPath 目录的所有调用关系中查找
   * - 找出所有 CallDependency.to 中包含 filePath 的文件
   * - 返回这些文件的 from 路径列表
   * - 结果可缓存
   */
  findCallers(filePath: string, dirPath: string): Promise<string[]>;
}
