// @intent: 将原始 CLI 参数翻译为 SearchTypeDefinitionUseCase 的输入协定。定义 CLI 特有逻辑：UseCase 返回 null 时打印用户友好消息而非格式化空值

import { getFormatter } from '../formatters';
import { CliDIContainer } from '../CliDIContainer';
import { parseArgs, hasFlag } from './utils';

export const command = 'search-type';
export const description = '在文件中搜索类型定义（interface、type、class、enum）';
export const usage = `cdd search-type <typeName> <filePath> [--language <lang>] [--json]`;

/**
 * @contract
 * 处理 search-type 命令。
 * 输入：args - CLI 参数数组
 * 输出：void - 结果直接写入 stdout
 * 错误：当 typeName 或 filePath 未提供时抛出使用说明
 * 副作用：调用 SearchTypeDefinitionUseCase 读取文件系统
 * @boundary
 * - typeName 是必填位置参数（第 1 个）
 * - filePath 是必填位置参数（第 2 个）
 * - language 可选，默认从文件扩展名推断
 */
export async function handler(args: string[]): Promise<void> {
  const { positional, flags } = parseArgs(args);
  const typeName = positional[0];
  const filePath = positional[1];

  if (!typeName || !filePath) {
    console.error('错误: 缺少必填参数 <typeName> <filePath>');
    console.error(`用法: ${usage}`);
    process.exit(1);
  }

  // @step: 构建输入参数
  const input = {
    typeName,
    filePath,
    language: flags.language,
  };

  // @step: 调用 UseCase
  const container = CliDIContainer.getInstance();
  const result = await container.searchTypeDefinitionUseCase.execute(input);

  // @step: 格式化输出
  const format = getFormatter(hasFlag(args, 'json') ? 'json' : 'pretty');
  if (result === null) {
    console.log(`类型 "${typeName}" 未在 ${filePath} 中找到`);
  } else {
    console.log(format(result));
  }
}
