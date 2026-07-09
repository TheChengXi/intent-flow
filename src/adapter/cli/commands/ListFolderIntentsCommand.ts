/**
 * @intent
 * CLI 命令：列出文件夹内所有文件的 @intent 意图清单。
 * 注册为 `cdd list-folder-intents <folder>`，支持 --json 输出。
 * 复用现有 CLI 参数解析模式（parseArgs / hasFlag）和 formatter（--json）。
 */

import { getFormatter } from '../formatters';
import { CliDIContainer } from '../CliDIContainer';
import { parseArgs, hasFlag } from './utils';

export const command = 'list-folder-intents';
export const description = '列出文件夹内所有文件的 @intent 意图清单';
export const usage = 'cdd list-folder-intents <folder> [--json]';

/**
 * @contract
 * 处理 list-folder-intents 命令。
 * 输入：args - CLI 参数数组
 * 输出：void - 结果直接写入 stdout
 * 错误：当 folder 未提供时打印用法并退出
 * 副作用：调用 ListFolderIntentsUseCase 读取文件系统
 */
export async function handler(args: string[]): Promise<void> {
  const { positional } = parseArgs(args);
  const folder = positional[0];

  if (!folder) {
    console.error('错误: 缺少必填参数 <folder>');
    console.error(`用法: ${usage}`);
    process.exit(1);
  }

  // @step: 调用 UseCase
  const container = CliDIContainer.getInstance();
  const result = await container.listFolderIntentsUseCase.execute(folder);

  // @step: 格式化输出
  const format = getFormatter(hasFlag(args, 'json') ? 'json' : 'pretty');
  console.log(format(result));
}
