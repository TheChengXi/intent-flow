/**
 * @intent
 * 将原始 CLI 参数翻译为 CheckFileSizeUseCase 的输入协定。仅支持 <filePath>（必填）和可选的 --threshold，已移除 --workspace-root 标志。
 */



import { getFormatter } from '../formatters';
import { CliDIContainer } from '../CliDIContainer';
import { parseArgs, hasFlag } from './utils';

export const command = 'check-file-size';
export const description = '检查文件及其依赖树的大小，识别需要重构的文件';
export const usage = `cdd check-file-size <filePath> [--threshold <number>] [--json]`;

/**
 * @contract
 * 处理 check-file-size 命令。
 * 输入：args - CLI 参数数组
 * 输出：void - 结果直接写入 stdout
 * 错误：当 filePath 未提供时抛出使用说明
 * 副作用：调用 CheckFileSizeUseCase 读取文件系统
 * @boundary
 * - filePath 是必填位置参数
 * - threshold 默认 400
 */
export async function handler(args: string[]): Promise<void> {
  const { positional, flags } = parseArgs(args);
  const filePath = positional[0];

  if (!filePath) {
    console.error('错误: 缺少必填参数 <filePath>');
    console.error(`用法: ${usage}`);
    process.exit(1);
  }

  // @step: 构建输入参数
  const input = {
    filePath,
    threshold: flags.threshold ? parseInt(flags.threshold, 10) : 400,
  };

  // @step: 调用 UseCase
  const container = CliDIContainer.getInstance();
  const result = await container.checkFileSizeUseCase.execute(input);

  // @step: 格式化输出
  const format = getFormatter(hasFlag(args, 'json') ? 'json' : 'pretty');
  console.log(format(result));
}
