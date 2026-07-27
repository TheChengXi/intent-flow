// @intent: 命令注册表，将用户态命令名（kebab-case）映射到命令处理模块。使 index.ts 无需感知具体命令模块的导入路径和接口细节

import { handler as checkFileSizeHandler } from './CheckFileSizeCommand';
import { handler as traceDependencyChainHandler } from './TraceDependencyChainCommand';
import { handler as projectIntentHandler } from './ProjectIntentCommand';
import { handler as listFolderIntentsHandler } from './ListFolderIntentsCommand';

export { command as checkFileSizeCmd, description as checkFileSizeDesc, usage as checkFileSizeUsage, handler as checkFileSizeHandler } from './CheckFileSizeCommand';
export { command as traceDependencyChainCmd, description as traceDependencyChainDesc, usage as traceDependencyChainUsage, handler as traceDependencyChainHandler } from './TraceDependencyChainCommand';
export { command as projectIntentCmd, description as projectIntentDesc, usage as projectIntentUsage, handler as projectIntentHandler } from './ProjectIntentCommand';
export { command as listFolderIntentsCmd, description as listFolderIntentsDesc, usage as listFolderIntentsUsage, handler as listFolderIntentsHandler } from './ListFolderIntentsCommand';

/**
 * @contract
 * 命令路由表。
 * 键为命令名，值为 { description, usage, handler }。
 */
export interface CommandEntry {
  description: string;
  usage: string;
  handler: (args: string[]) => Promise<void>;
}

export const commandMap: Record<string, CommandEntry> = {
  'check-file-size': {
    description: '检查文件及其依赖树的大小，识别需要重构的文件',
    usage: 'cdd check-file-size <filePath> [--workspace-root <path>] [--threshold <number>] [--json]',
    handler: checkFileSizeHandler,
  },
  'trace-dependency-chain': {
    description: '沿入口文件的依赖链追踪，分析直接依赖关系及 @intent 语义',
    usage: 'cdd trace-dependency-chain <entryFile> [--project-root <path>] [--mode simple|normal|complex] [--json]',
    handler: traceDependencyChainHandler,
  },
  'project-intent': {
    description: '创建文件并写入 @intent 注释，自动创建父目录',
    usage: 'cdd project-intent <path> --intent <desc> [--force] [--json]',
    handler: projectIntentHandler,
  },
  'intent-package': {
    description: '意图包管理：增量更新、列举、查看、语义检索',
    usage: 'cdd intent-package <subcommand> [args]',
    handler: intentPackageHandler,
  },
  'list-folder-intents': {
    description: '列出文件夹内所有文件的 @intent 意图清单',
    usage: 'cdd list-folder-intents <folder> [--json]',
    handler: listFolderIntentsHandler,
  },
};

export const commandNames = Object.keys(commandMap);
