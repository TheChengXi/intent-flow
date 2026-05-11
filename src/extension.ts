import * as vscode from 'vscode';
import * as CompileCommand from './viewmodel/commands/CompileCommand';
import * as ReviewCommand from './viewmodel/commands/ReviewCommand';
import * as TranslateCommand from './viewmodel/commands/TranslateCommand';
import * as AnalyzeCommand from './viewmodel/commands/AnalyzeCommand';
import * as InitCommand from './viewmodel/commands/InitCommand';

// @contract: activate(context: vscode.ExtensionContext) => void
// @step: [注册命令] 注册所有 Command（compile, review, translate, analyze, init）
// @step: [注册菜单] 注册右键菜单和命令面板
// @step: [初始化服务] 初始化 ClaudeAPIService、FileRepository 等单例
// @boundary: 当激活失败时，记录错误日志但不阻塞 VSCode
export function activate(context: vscode.ExtensionContext) {
  console.log('CDD Validator 已激活');

  const compileCommand = vscode.commands.registerCommand('cdd.compile', CompileCommand.execute);
  const reviewCommand = vscode.commands.registerCommand('cdd.review', ReviewCommand.execute);
  const translateCommand = vscode.commands.registerCommand('cdd.translate', TranslateCommand.execute);
  const analyzeCommand = vscode.commands.registerCommand('cdd.analyze', AnalyzeCommand.execute);
  const initCommand = vscode.commands.registerCommand('cdd.init', InitCommand.execute);

  context.subscriptions.push(compileCommand);
  context.subscriptions.push(reviewCommand);
  context.subscriptions.push(translateCommand);
  context.subscriptions.push(analyzeCommand);
  context.subscriptions.push(initCommand);
}
// @end



// @contract: deactivate() => void
// @step: [通知] 输出停用日志到控制台
// @boundary: 当函数执行时，应输出 'CDD Validator 已停用' 消息
export function deactivate() {
  console.log('CDD Validator 已停用');
}
// @end
