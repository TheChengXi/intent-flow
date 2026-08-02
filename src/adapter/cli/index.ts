#!/usr/bin/env node
// @intent: CLI 适配器入口。解析顶层命令分派到子模块、统一处理 --help 和 --json 全局选项、管理进程退出码

import { commandMap, commandNames } from './commands';

/**
 * @contract
 * CLI 入口函数。
 * 输入：无（从 process.argv 读取）
 * 输出：void - 命令结果写入 stdout，错误写入 stderr
 * 副作用：
 *   - 匹配命令名并调用对应 handler
 *   - 未知命令或 --help 时打印使用说明
 *   - 命令执行出错时打印错误信息并 process.exit(1)
 * @boundary
 * - process.argv[0] = node，process.argv[1] = 脚本路径，process.argv[2] = 命令名
 * - 无命令名或 --help 时显示帮助
 */
async function main(): Promise<void> {
  // @step: 解析命令名（跳过 node 可执行文件和脚本路径）
  const args = process.argv.slice(2);
  const cmd = args[0];

  // @step: 无命令或请求帮助时显示帮助
  if (!cmd || cmd === '--help' || cmd === '-h') {
    showHelp();
    return;
  }

  // @step: 在路由表中查找命令
  const entry = commandMap[cmd];
  if (!entry) {
    console.error(`未知命令: ${cmd}`);
    console.error('');
    showHelp();
    process.exit(1);
  }

  // @step: 命令请求帮助
  const cmdArgs = args.slice(1);
  if (cmdArgs[0] === '--help' || cmdArgs[0] === '-h') {
    console.log(`用法: ${entry.usage}`);
    console.log('');
    console.log(entry.description);
    return;
  }

  // @step: 执行命令
  try {
    await entry.handler(cmdArgs);
  } catch (error: any) {
    // @boundary: 命令执行异常时输出错误并退出
    console.error(`错误: ${error.message || error}`);
    if (error.stack) {
      console.error(`\n${error.stack}`);
    }
    process.exit(1);
  }
}

/**
 * @contract
 * 显示全局帮助信息。
 * 输入：无
 * 输出：void - 帮助信息写入 stdout
 * 副作用：无
 */
function showHelp(): void {
  console.log('IntentFlow — CLI 工具');
  console.log('');
  console.log('用法: iflow <command> [args...] [options...]');
  console.log('');
  console.log('命令:');

  // @step: 按命令名排序输出
  const sortedNames = [...commandNames].sort();
  for (const name of sortedNames) {
    const entry = commandMap[name];
    console.log(`  ${name.padEnd(20)} ${entry.description}`);
  }

  console.log('');
  console.log('全局选项:');
  console.log('  --help, -h             显示帮助信息');
  console.log('  --json                 以 JSON 格式输出（每个命令支持）');
  console.log('');
  console.log('对单个命令查看详细用法: iflow <command> --help');
}

// @step: 执行入口
main().catch((error) => {
  console.error(`未捕获的错误: ${error.message || error}`);
  process.exit(1);
});
