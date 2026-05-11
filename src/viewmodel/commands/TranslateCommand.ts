import * as vscode from 'vscode';
import { TranslatorVM } from '../roles/TranslatorVM';
import { ClaudeAPIService } from '../../model/services/ClaudeAPIService';
import { TranslatorContextManager } from '../context/TranslatorContextManager';
import * as WorkScheduleRepo from '../../model/repositories/WorkScheduleRepo';
import * as CommentParser from '../../model/services/CommentParser';

// @contract: execute() => Promise<void>
// @step: [获取选区] 获取当前编辑器选中的代码
// @step: [准备上下文] 调用 TranslatorContextManager.prepare
// @step: [读取配置] 读取 apiKey、apiBaseUrl、modelId 配置
// @step: [转译] 调用 TranslatorVM.execute
// @step: [插入注释] 在代码上方插入生成的注释
// @step: [保存历史] 调用 TranslatorContextManager.save
// @step: [记录日志] 调用 WorkScheduleRepo.addRecord
// @step: [提示] 显示"注释已生成，请人工审查后再编译"
// @boundary: 当未选中文本时，提示"请选中要转译的代码块"
// @boundary: 当 API 返回 LogicUnclearError 时，按 BUSINESS_RULES 流程3异常处理
export async function execute(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('未打开编辑器');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showErrorMessage('请选中要转译的代码块');
    return;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('未打开工作区');
    return;
  }

  const apiKey = vscode.workspace.getConfiguration('cdd').get<string>('apiKey') || '';
  if (!apiKey) {
    vscode.window.showErrorMessage('请先配置 API Key');
    return;
  }

  const apiBaseUrl = vscode.workspace.getConfiguration('cdd').get<string>('apiBaseUrl') || undefined;
  const modelId = vscode.workspace.getConfiguration('cdd').get<string>('modelId') || undefined;

  // 准备上下文
  const context = await TranslatorContextManager.prepare(
    editor.document,
    selection,
    workspaceRoot,
    apiKey,
    apiBaseUrl,
    modelId
  );

  const apiService = new ClaudeAPIService();
  const translatorVM = new TranslatorVM(apiService);

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '正在转译为注释...',
      cancellable: false
    },
    async () => {
      return await translatorVM.execute(context);
    }
  );

  if (!result.success) {
    vscode.window.showErrorMessage(`转译失败：${result.message}`);
    return;
  }

  const commentText = result.artifacts as string;
  const insertPosition = selection.start;
  await editor.edit(editBuilder => {
    editBuilder.insert(insertPosition, commentText + '\n');
  });

  // 解析生成的注释以提取函数名
  const comment = CommentParser.parseComment(commentText, editor.document, selection.start.line);
  const functionName = comment?.contract.functionName || 'unknown';

  // 保存历史
  await TranslatorContextManager.save(
    workspaceRoot,
    editor.document.fileName,
    functionName,
    functionName + ':v1.0',
    context.code,
    commentText,
    true,
    context.compileSpec
  );

  const now = new Date();
  await WorkScheduleRepo.addRecord(
    {
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0],
      role: '转译员',
      description: `转译代码为注释: ${functionName}`,
      duration: 0,
      dependencies: []
    },
    workspaceRoot
  );

  vscode.window.showInformationMessage('注释已生成，请人工审查后再编译');
}
// @end
