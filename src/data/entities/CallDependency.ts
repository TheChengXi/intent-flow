/**
 * @intent 文件之间的调用/导入依赖关系
 * @entity
 */

export interface CallDependency {
  /**
   * 调用者文件的绝对路径（规范化为 / 分隔符）
   * 这个文件 import 了其他文件
   */
  from: string;

  /**
   * 被调用文件的绝对路径列表
   * 这个数组包含 from 文件所导入的所有其他文件的路径
   */
  to: string[];

  /**
   * 导入类型（未来扩展）
   * 'import' - ES6 import 语句
   * 'require' - CommonJS require 语句
   * 'dynamic' - 动态 import (未来支持)
   */
  type?: 'import' | 'require' | 'dynamic';
}
