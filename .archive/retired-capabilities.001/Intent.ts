/**
 * @intent 代码文件的意图信息实体
 * @entity
 */

export interface Intent {
  /**
   * 文件的绝对路径（规范化为 / 分隔符）
   */
  filePath: string;

  /**
   * 文件名（不含路径）
   */
  fileName: string;

  /**
   * @intent 注解的原始内容
   * 格式：一句话描述这个文件的目的
   * 例如："用户数据仓库实现"、"订单价格计算用例"
   */
  intent: string;

  /**
   * 文件所属的架构层级
   * 推导规则：基于文件路径和配置自动推导
   * 可选值：'data' | 'application' | 'adapter' | 自定义层级名
   */
  layer?: string;

  /**
   * 文件最后修改时间戳（毫秒）
   * 用途：缓存失效检测
   */
  timestamp: number;
}
