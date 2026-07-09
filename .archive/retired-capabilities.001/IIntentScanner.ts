/**
 * @intent 退役接口（原 ICodeParserRepository 的一部分）
 *
 * extractIntentsFromDirectory 原本是 ICodeParserRepository 的方法，
 * 但它做的事情（扫描目录）与该接口的核心职责（解析代码）不在同一抽象维度。
 *
 * 保留此接口作为抽象记录，同时避免污染 ICodeParserRepository。
 *
 * 退役原因：
 * - 「扫所有文件的所有 @intent」是一个无边界问题
 * - 真正的需求永远是「跟当前上下文相关的 intent」，用 Glob + Grep 更精准
 * - ICodeParserRepository 不应承担文件系统扫描的职责
 */

import { Intent } from './Intent';

export interface IIntentScanner {
  /**
   * 扫描目录中所有文件的 @intent 注解
   * @param directoryPath 目录路径
   * @param recursive 是否递归扫描
   * @param extensions 文件扩展名过滤
   * @returns Intent 对象数组
   */
  extractIntentsFromDirectory(
    directoryPath: string,
    recursive?: boolean,
    extensions?: string[]
  ): Promise<Intent[]>;
}
