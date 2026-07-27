import { IntentPackage } from '../entities/IntentPackage';

/**
 * @intent
 * 意图包的文件存储抽象边界。
 * 屏蔽 .cdd/packages/*.yml 的读写细节，提供原子性的 save/load/list/delete 操作。
 * 调用方不关心 YAML 序列化和文件原子写入的实现。
 */

export interface IIntentPackageRepository {
  /**
   * @contract
   * 写入包文件。使用临时文件 + rename 保证原子性。
   * 输入：pkg - 完整的 IntentPackage 实体
   * 输出：Promise<void>
   * 错误：当目录不可写入时抛出
   * 副作用：写文件系统
   */
  save(pkg: IntentPackage): Promise<void>;

  /**
   * @contract
   * 按名称读取包文件。
   * 输入：name - 包名
   * 输出：IntentPackage | null - 文件不存在时返回 null
   * 错误：当 YAML 格式损坏时记录日志并返回 null
   * 副作用：读文件系统
   */
  load(name: string): Promise<IntentPackage | null>;

  /**
   * @contract
   * 返回所有可用包名列表。
   * 输出：包名数组
   * 副作用：扫描目录（不读文件内容）
   */
  list(): Promise<string[]>;

  /**
   * @contract
   * 按源文件夹路径筛选包名。遍历所有包文件的 groups 字段反查。
   * 输入：folder - 文件夹路径
   * 输出：匹配的包名数组
   * 副作用：读文件系统
   */
  listByFolder(folder: string): Promise<string[]>;

  /**
   * @contract
   * 删除包文件。
   * 输入：name - 包名
   * 输出：Promise<void>
   * 错误：文件不存在时静默成功
   * 副作用：删文件系统
   */
  delete(name: string): Promise<void>;

  /**
   * @contract
   * 检查包文件是否存在。
   * 输入：name - 包名
   * 输出：boolean
   * 副作用：读文件系统
   */
  exists(name: string): Promise<boolean>;
}
