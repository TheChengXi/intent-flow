/**
 * @intent
 * CLI 命令：意图包的增删查操作入口。
 * 支持子命令：update（增量重算）、list（列举）、get（查看）、search（检索）。
 * 复用现有 CLI 参数解析模式（parseArgs / hasFlag）和 formatter（--json）。
 */

import { getFormatter } from '../formatters';
import { parseArgs, hasFlag } from './utils';
import { CliDIContainer } from '../CliDIContainer';

export const command = 'intent-package';
export const description = '意图包管理：增量更新、列举、查看、语义检索';
export const usage = `cdd intent-package <subcommand> [args]

子命令：
  update [folder]       增量重算目标文件夹的意图包（默认全项目）
  list [--include-deprecated]  列举所有包
  get <name>            查看单个包详情
  search <query>        语义检索包

选项：
  --json                以 JSON 格式输出`;

// @contract: handler(args) => Promise<void>
// @step: [解析子命令] 从第一个位置参数获取子命令名
// @step: [路由分发] 按子命令调用对应的 use case 或 service
// @step: [格式化输出] 使用 formatter 输出结果
// @boundary: 未知子命令时打印使用说明
// @boundary: 所有异常被 catch 后输出错误信息
export async function handler(args: string[]): Promise<void> {
  const { positional } = parseArgs(args);
  const subcommand = positional[0];

  if (!subcommand) {
    console.error(usage);
    return;
  }

  const container = CliDIContainer.getInstance();
  const formatter = getFormatter(hasFlag(args, 'json') ? 'json' : 'pretty');

  try {
    switch (subcommand) {
      case 'get': {
        const name = positional[1];
        if (!name) {
          console.error('请指定包名: cdd intent-package get <name>');
          return;
        }
        const view = await container.intentPackageQueryService.getPackage(name);
        if (!view) {
          console.log(formatter({ error: `package not found: ${name}` }));
          return;
        }
        console.log(formatter(view));
        break;
      }

      case 'list': {
        const includeDeprecated = hasFlag(args, 'include-deprecated');
        const packages = await container.intentPackageQueryService.listPackages(includeDeprecated);
        console.log(formatter({ packages }));
        break;
      }

      case 'update': {
        const folderPath = positional[1];
        if (!folderPath) {
          console.error('请指定文件夹路径: cdd intent-package update <folder>');
          return;
        }
        const result = await container.maintainIntentPackagesUseCase.execute({ folderPath });
        console.log(formatter(result));
        break;
      }

      case 'search': {
        const query = positional.slice(1).join(' ');
        if (!query) {
          console.error('请指定查询语句: cdd intent-package search <query>');
          return;
        }
        const results = await container.intentPackageQueryService.searchPackages(query);
        console.log(formatter({ results }));
        break;
      }

      default:
        console.error(`未知子命令: ${subcommand}`);
        console.error(usage);
    }
  } catch (err) {
    console.error(`[intent-package] 错误:`, err instanceof Error ? err.message : String(err));
  }
}
