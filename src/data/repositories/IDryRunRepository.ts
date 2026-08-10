/**
 * @intent
 * 拦截记录持久化的抽象边界，屏蔽文件 IO 与 vscode 工作区解析，使 application 层可脱离 vscode 环境运行与测试。
 * 边界：save 返回落盘文件绝对路径；输出目录不存在时自行递归创建；失败抛错不吞异常。
 * 验收条件：
 * - 接口零 import（不引入 vscode/fs 等运行时模块）
 * - save 签名与 DryRunRepository 现状一致（record, outputDir）=> Promise<string>
 */

import type { DryRunRecord } from '../entities/DryRunRecord';

// @repository: IDryRunRepository
// 拦截记录持久化接口（零运行时依赖，type-only import）
export interface IDryRunRepository {
  // @contract: save(record: DryRunRecord, outputDir: string) => Promise<string>
  // @step: [落盘] 将记录序列化写入 outputDir 对应文件
  // @boundary: 返回文件绝对路径；目录不存在时递归创建；失败抛错
  save(record: DryRunRecord, outputDir: string): Promise<string>;
}
