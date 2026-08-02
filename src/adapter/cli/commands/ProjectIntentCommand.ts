// @intent: 将原始 CLI 参数翻译为 ProjectIntentUseCase 的输入协定。定义 CLI 特有逻辑：intent 为必填 --intent 参数，force 支持 --force 标志和 --force=true 两种写法

import { getFormatter } from '../formatters';
import { CliDIContainer } from '../CliDIContainer';
import { parseArgs, hasFlag } from './utils';

export const command = 'project-intent';
export const description = '创建/更新 @intent 注释，文件已存在时替换/插入 @intent，保留其他内容';
export const usage = `iflow project-intent <path> --intent <desc> [--force] [--json]`;

/**
 * @contract
 * 处理 project-intent 命令。
 * 输入：args - CLI 参数数组
 * 输出：void - 结果直接写入 stdout
 * 错误：当 path 或 intent 未提供时抛出使用说明
 * 副作用：调用 ProjectIntentUseCase 写入文件系统
 * @boundary
 * - path 是必填位置参数
 * - intent 是必填标志参数
 * - force 默认为 false（不修改已有文件）；force=true 时替换/插入 @intent，不覆盖其他内容
 */
export async function handler(args: string[]): Promise<void> {
  const { positional, flags } = parseArgs(args);
  const filePath = positional[0];

  if (!filePath) {
    console.error('错误: 缺少必填参数 <path>');
    console.error(`用法: ${usage}`);
    process.exit(1);
  }

  const intent = flags.intent;
  if (!intent) {
    console.error('错误: 缺少必填参数 --intent <desc>');
    console.error(`用法: ${usage}`);
    process.exit(1);
  }

  // @step: 构建输入参数
  const input = {
    path: filePath,
    intent,
    force: flags.force === 'true' || hasFlag(args, 'force'),
  };

  // @step: 调用 UseCase
  const container = CliDIContainer.getInstance();
  const result = await container.projectIntentUseCase.execute(input);

  // @step: 格式化输出
  const format = getFormatter(hasFlag(args, 'json') ? 'json' : 'pretty');
  console.log(format(result));
}
