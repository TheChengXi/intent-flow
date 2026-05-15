// @intent: CDD Framework VSCode 扩展的入口文件，注册命令和 Chat Participant

import * as vscode from 'vscode';
import * as CompileCommand from './viewmodel/commands/CompileCommand';
import * as ReviewCommand from './viewmodel/commands/ReviewCommand';
import * as TranslateCommand from './viewmodel/commands/TranslateCommand';
import * as AnalyzeCommand from './viewmodel/commands/AnalyzeCommand';
import * as InitCommand from './viewmodel/commands/InitCommand';
import * as CheckFileSizeCommand from './viewmodel/commands/CheckFileSizeCommand';
import { handleCDDChat } from './chat/CDDChatHandler';

// @contract: activate(context: vscode.ExtensionContext) => void
// @step: [初始化] 输出激活日志
// @step: [注册命令] 注册 5 个命令处理器（compile、review、translate、analyze、init）
// @step: [注册 Chat Participant] 注册 CDD 聊天助手
// @step: [注册辅助命令] 注册 insertComment 和 insertCode 命令
// @step: [订阅] 将所有注册器推入上下文订阅列表以确保资源清理
// @boundary: 当 context 为 undefined 时，应抛出 TypeError
// @boundary: 当命令注册失败时，应捕获异常并输出错误日志
// @boundary: 当订阅列表已满时，应检查内存泄漏风险

export function activate(context: vscode.ExtensionContext) {
  console.log('CDD Validator 已激活');

  // 注册命令
  const compileCommand = vscode.commands.registerCommand('cdd.compile', CompileCommand.execute);
  const reviewCommand = vscode.commands.registerCommand('cdd.review', ReviewCommand.execute);
  const translateCommand = vscode.commands.registerCommand('cdd.translate', TranslateCommand.execute);
  const analyzeCommand = vscode.commands.registerCommand('cdd.analyze', AnalyzeCommand.execute);
  const initCommand = vscode.commands.registerCommand('cdd.init', InitCommand.execute);
  const checkFileSizeCommand = vscode.commands.registerCommand('cdd.checkFileSize', CheckFileSizeCommand.execute);
  const checkCurrentFileCommand = vscode.commands.registerCommand('cdd.checkCurrentFileWithDeps', CheckFileSizeCommand.checkCurrentFileWithDependencies);

  context.subscriptions.push(compileCommand);
  context.subscriptions.push(reviewCommand);
  context.subscriptions.push(translateCommand);
  context.subscriptions.push(analyzeCommand);
  context.subscriptions.push(initCommand);
  context.subscriptions.push(checkFileSizeCommand);
  context.subscriptions.push(checkCurrentFileCommand);

  // 注册 Chat Participant
  const cddParticipant = vscode.chat.createChatParticipant('cdd', handleCDDChat);
  cddParticipant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'resources', 'cdd-icon.png');
  context.subscriptions.push(cddParticipant);

  // 注册辅助命令（用于 Chat 按钮）
  const insertCommentCommand = vscode.commands.registerCommand('cdd.insertComment', (comment: string) => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      editor.edit(editBuilder => {
        editBuilder.insert(editor.selection.active, comment);
      });
    }
  });

  const insertCodeCommand = vscode.commands.registerCommand('cdd.insertCode', (code: string) => {
    const editor = vscode.window.activeTextEditor;
    if (editor) {
      editor.edit(editBuilder => {
        editBuilder.insert(editor.selection.active, code);
      });
    }
  });

  context.subscriptions.push(insertCommentCommand);
  context.subscriptions.push(insertCodeCommand);
}
// @end



// @contract: deactivate() => void
// @step: [通知] 输出停用日志到控制台
// @boundary: 当函数执行时，应输出 'CDD Validator 已停用' 消息
export function deactivate() {
  console.log('CDD Validator 已停用');
}
// @end
