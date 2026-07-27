// @intent: VSCode 扩展入口。处理 activate/deactivate 生命周期，初始化 Dry Run 功能（Manager/Interceptor/UI），注册全部命令（含 4 个已废弃的遗留命令）

import * as vscode from 'vscode';
// @warn: CompileCommand/ReviewCommand/TranslateCommand/RequirementTranslatorCommand 已废弃
import * as CheckFileSizeCommand from './commands/CheckFileSizeCommand';
import * as CapabilityMapCommand from './commands/CapabilityMapCommand';
import * as ProjectIntentsCommand from './commands/ProjectIntentsCommand';
import * as AddToIntentsCommand from './commands/AddToIntentsCommand';
import * as RemoveFromIntentsCommand from './commands/RemoveFromIntentsCommand';

// Dry Run 功能导入
import { DryRunManager } from './application/dryrun/DryRunManager';
// @warn: APIService 和 APIInterceptor 已废弃（转至 .archive/retired-vscode.005）
import { ToggleDryRunCommand } from './commands/ToggleDryRunCommand';
import { DryRunStatusBarItem } from './ui/DryRunStatusBarItem';
import { DryRunOutputChannel } from './ui/DryRunOutputChannel';
import { IntentFileWatcher } from './services/IntentFileWatcher';
import { VSCodeDIContainer } from './VSCodeDIContainer';

// @contract: activate(context: vscode.ExtensionContext) => void
// @step: [初始化] 输出激活日志
// @step: [注册命令] 注册命令处理器（compile、review、translate、requirementTranslator、init、checkFileSize）
// @step: [订阅] 将所有注册器推入上下文订阅列表以确保资源清理
// @boundary: 当 context 为 undefined 时，应抛出 TypeError
// @boundary: 当命令注册失败时，应捕获异常并输出错误日志
// @boundary: 当订阅列表已满时，应检查内存泄漏风险

export function activate(context: vscode.ExtensionContext) {
  console.log('CDD Validator 已激活');

  // @warn: Dry Run 功能（apiService/APIInterceptor）已废弃，待后续清理
  // 保留 DryRunManager/ToggleDryRunCommand 的注册以防破坏性变更
  const dryRunManager = DryRunManager.getInstance();
  const dryRunStatusBar = new DryRunStatusBarItem(dryRunManager);
  const dryRunOutputChannel = new DryRunOutputChannel(dryRunManager);
  dryRunStatusBar.initialize();
  dryRunOutputChannel.initialize();
  const toggleDryRunCommand = new ToggleDryRunCommand(dryRunManager);
  const toggleDryRunDisposable = vscode.commands.registerCommand('cdd.toggleDryRun', () => toggleDryRunCommand.execute());

  // @warn: compile/review/translate/requirementTranslator 命令已废弃
  const checkFileSizeCommand = vscode.commands.registerCommand('cdd.checkFileSize', CheckFileSizeCommand.execute);
  const checkCurrentFileCommand = vscode.commands.registerCommand('cdd.checkCurrentFileWithDeps', CheckFileSizeCommand.checkCurrentFileWithDependencies);

  // 注册能力地图命令
  const capabilityMapCommand = vscode.commands.registerCommand(
    CapabilityMapCommand.command,
    () => CapabilityMapCommand.handler(context)
  );

  context.subscriptions.push(toggleDryRunDisposable);
  context.subscriptions.push(dryRunStatusBar);
  context.subscriptions.push(dryRunOutputChannel);
  // @warn: compile/review/translate/requirementTranslator 命令注册已移除
  context.subscriptions.push(checkFileSizeCommand);
  context.subscriptions.push(checkCurrentFileCommand);
  context.subscriptions.push(capabilityMapCommand);

  // ==================== 意图投射（.cdd/intents/） ====================

  // 注册手动重建命令
  const projectIntentsCommand = vscode.commands.registerCommand(
    ProjectIntentsCommand.command,
    ProjectIntentsCommand.handler
  );
  context.subscriptions.push(projectIntentsCommand);

  // 注册右键菜单命令：添加文件夹到意图目录
  const addToIntentsCommand = vscode.commands.registerCommand(
    AddToIntentsCommand.command,
    AddToIntentsCommand.handler
  );
  context.subscriptions.push(addToIntentsCommand);

  // 注册右键菜单命令：从意图目录移除
  const removeFromIntentsCommand = vscode.commands.registerCommand(
    RemoveFromIntentsCommand.command,
    RemoveFromIntentsCommand.handler
  );
  context.subscriptions.push(removeFromIntentsCommand);

  // 自动启动文件监听（仅在有工作区时）
  const root = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
  if (root) {
    const container = VSCodeDIContainer.getInstance();
    const fileWatcher = new IntentFileWatcher(
      container.getCore().projectIntentsToFilesUseCase,
      root
    );
    fileWatcher.start(context).catch(err => {
      console.error('[CDD] IntentFileWatcher 启动失败:', err);
    });
  }
}
// @end



// @contract: deactivate() => void
// @step: [通知] 输出停用日志到控制台
// @boundary: 当函数执行时，应输出 'CDD Validator 已停用' 消息
export function deactivate() {
  console.log('CDD Validator 已停用');
}
// @end
