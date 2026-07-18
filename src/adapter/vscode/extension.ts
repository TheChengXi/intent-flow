// @intent: VSCode 扩展入口。处理 activate/deactivate 生命周期，初始化 Dry Run 功能（Manager/Interceptor/UI），注册全部命令（含 4 个已废弃的遗留命令）

import * as vscode from 'vscode';
import * as CompileCommand from './commands/CompileCommand';
import * as ReviewCommand from './commands/ReviewCommand';
import * as TranslateCommand from './commands/TranslateCommand';
import * as RequirementTranslatorCommand from './commands/RequirementTranslatorCommand';
import * as CheckFileSizeCommand from './commands/CheckFileSizeCommand';

// Dry Run 功能导入
import { DryRunManager } from './application/dryrun/DryRunManager';
import { APIService } from '../../data/services/aiAPIservice/APIService';
import { APIInterceptor } from './application/dryrun/APIInterceptor';
import { ToggleDryRunCommand } from './commands/ToggleDryRunCommand';
import { DryRunStatusBarItem } from './ui/DryRunStatusBarItem';
import { DryRunOutputChannel } from './ui/DryRunOutputChannel';

// @contract: activate(context: vscode.ExtensionContext) => void
// @step: [初始化] 输出激活日志
// @step: [注册命令] 注册命令处理器（compile、review、translate、requirementTranslator、init、checkFileSize）
// @step: [订阅] 将所有注册器推入上下文订阅列表以确保资源清理
// @boundary: 当 context 为 undefined 时，应抛出 TypeError
// @boundary: 当命令注册失败时，应捕获异常并输出错误日志
// @boundary: 当订阅列表已满时，应检查内存泄漏风险

export function activate(context: vscode.ExtensionContext) {
  console.log('CDD Validator 已激活');

  // 初始化 Dry Run 功能
  const dryRunManager = DryRunManager.getInstance();
  const apiService = new APIService();
  const apiInterceptor = new APIInterceptor(apiService, dryRunManager);

  // 创建 Dry Run UI 组件
  const dryRunStatusBar = new DryRunStatusBarItem(dryRunManager);
  const dryRunOutputChannel = new DryRunOutputChannel(dryRunManager);

  // 初始化 UI 组件
  dryRunStatusBar.initialize();
  dryRunOutputChannel.initialize();

  // 注册 Dry Run 命令
  const toggleDryRunCommand = new ToggleDryRunCommand(dryRunManager);
  const toggleDryRunDisposable = vscode.commands.registerCommand('cdd.toggleDryRun', () => toggleDryRunCommand.execute());

  // 注册命令
  const compileCommand = vscode.commands.registerCommand('cdd.compile', CompileCommand.execute);
  const reviewCommand = vscode.commands.registerCommand('cdd.review', ReviewCommand.execute);
  const translateCommand = vscode.commands.registerCommand('cdd.translate', TranslateCommand.execute);
  const requirementTranslatorCommand = vscode.commands.registerCommand('cdd.requirementTranslator', RequirementTranslatorCommand.execute);
  const checkFileSizeCommand = vscode.commands.registerCommand('cdd.checkFileSize', CheckFileSizeCommand.execute);
  const checkCurrentFileCommand = vscode.commands.registerCommand('cdd.checkCurrentFileWithDeps', CheckFileSizeCommand.checkCurrentFileWithDependencies);

  context.subscriptions.push(toggleDryRunDisposable);
  context.subscriptions.push(dryRunStatusBar);
  context.subscriptions.push(dryRunOutputChannel);
  context.subscriptions.push(compileCommand);
  context.subscriptions.push(reviewCommand);
  context.subscriptions.push(translateCommand);
  context.subscriptions.push(requirementTranslatorCommand);
  context.subscriptions.push(checkFileSizeCommand);
  context.subscriptions.push(checkCurrentFileCommand);
  context.subscriptions.push(capabilityMapCommand);
}
// @end



// @contract: deactivate() => void
// @step: [通知] 输出停用日志到控制台
// @boundary: 当函数执行时，应输出 'CDD Validator 已停用' 消息
export function deactivate() {
  console.log('CDD Validator 已停用');
}
// @end
