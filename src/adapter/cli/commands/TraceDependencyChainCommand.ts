// @intent: 将原始 CLI 参数翻译为 TraceDependencyChainUseCase 的输入协定。定义 CLI 特有逻辑：mode 取值校验（仅 simple/normal/complex）、projectRoot 默认 cwd

import { getFormatter } from '../formatters';
import { CliDIContainer } from '../CliDIContainer';
import { parseArgs, hasFlag } from './utils';

export const command = 'trace-dependency-chain';
export const description = '沿入口文件的依赖链追踪，分析直接依赖关系及 @intent 语义';
export const usage = `cdd trace-dependency-chain <entryFile> [--project-root <path>] [--mode simple|normal|complex] [--json]`;

/**
 * @contract
 * 处理 trace-dependency-chain 命令。
 * 输入：args - CLI 参数数组
 * 输出：void - 结果直接写入 stdout
 * 错误：当 entryFile 未提供时抛出使用说明
 * 副作用：调用 TraceDependencyChainUseCase 读取文件系统
 * @boundary
 * - entryFile 是必填位置参数
 * - projectRoot 默认 process.cwd()
 * - mode 默认 simple
 */
export async function handler(args: string[]): Promise<void> {
  const { positional, flags } = parseArgs(args);
  const entryFile = positional[0];

  if (!entryFile) {
    console.error('错误: 缺少必填参数 <entryFile>');
    console.error(`用法: ${usage}`);
    process.exit(1);
  }

  // @step: 验证 mode 参数
  const mode = flags.mode || 'simple';
  if (!['simple', 'normal', 'complex'].includes(mode)) {
    console.error(`错误: 无效的 mode 值 "${mode}"，可选值: simple, normal, complex`);
    process.exit(1);
  }

  // @step: 构建输入参数
  const input = {
    entryFile,
    projectRoot: flags['project-root'] || process.cwd(),
    mode: mode as 'simple' | 'normal' | 'complex',
  };

  // @step: 调用 UseCase
  const container = CliDIContainer.getInstance();
  const result = await container.traceDependencyChainUseCase.execute(input);

  // @step: 格式化输出
  const format = getFormatter(hasFlag(args, 'json') ? 'json' : 'pretty');
  console.log(format(result));
}
