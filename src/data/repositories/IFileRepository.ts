/**
 * @intent
 * 文件系统操作的抽象边界，让核心层与 Node.js fs 解耦。
 * 屏蔽：测试时可用 Mock 替代真实文件系统；scanDirectory 自动过滤 .git/node_modules
 */

export interface IFileRepository {
  /**
   * 读取文件内容
   * @param filePath 文件路径
   * @returns 文件内容
   */
  readFile(filePath: string): Promise<string>;

  /**
   * 检查文件是否存在
   * @param filePath 文件路径
   * @returns 是否存在
   */
  exists(filePath: string): Promise<boolean>;

  /**
   * 获取文件修改时间
   * @param filePath 文件路径
   * @returns 修改时间（毫秒时间戳）
   */
  getModifiedTime(filePath: string): Promise<number>;

  /**
   * 监听文件变化
   * @param filePath 文件路径
   * @param callback 变化回调
   */
  watchFile(filePath: string, callback: (filePath: string) => void): void;

  /**
   * 取消监听文件
   * @param filePath 文件路径
   */
  unwatchFile(filePath: string): void;

  /**
   * 获取文件行数
   * @param filePath 文件路径
   * @returns 行数
   */
  getLineCount(filePath: string): Promise<number>;

  /**
   * 写入文件内容（自动创建父目录）
   * @param filePath 文件路径
   * @param content 文件内容
   */
  writeFile(filePath: string, content: string): Promise<void>;

  /**
   * 确保目录存在（递归创建）
   * @param dirPath 目录路径
   */
  ensureDir(dirPath: string): Promise<void>;

  /**
   * 扫描目录获取文件列表
   * @param dirPath 目录路径
   * @param options 扫描选项
   * @param options.extensions 文件扩展名过滤，如 ['.ts', '.tsx']
   * @param options.recursive 是否递归扫描子目录，默认 true
   * @returns 匹配的文件路径数组
   */
  scanDirectory(
    dirPath: string,
    options?: {
      extensions?: string[];
      recursive?: boolean;
    }
  ): Promise<string[]>;

  /**
   * 删除文件
   * @param filePath 文件路径
   */
  deleteFile(filePath: string): Promise<void>;

  /**
   * 列出目录下的直接子目录名（非递归）。
   * 与 scanDirectory 形成对偶：scanDirectory 返回文件，listSubdirectories 返回子目录。
   * @param dirPath 目录路径
   * @returns 子目录名称数组（不含路径）
   * @boundary 目录不存在时返回空数组
   */
  listSubdirectories(dirPath: string): Promise<string[]>;
}
