import * as vscode from 'vscode';
import { executeCDDWorkflow } from '../workflow/CDDWorkflow';
import { WorkflowContext } from '../workflow/WorkflowTypes';
import * as WorkScheduleRepo from '../../data/repositories/WorkScheduleRepo';

// @contract: execute() => Promise<void>
// @step: [获取选区] 获取当前编辑器选中的文本范围
// @step: [读取配置] 读取 apiKey、apiBaseUrl、modelId 配置
// @step: [构建上下文] 构建 WorkflowContext
// @step: [执行工作流] 调用 executeCDDWorkflow
// @step: [记录日志] 调用 WorkScheduleRepo.addRecord
// @step: [显示结果] 根据工作流结果显示消息
// @boundary: 当未选中文本时，提示"请选中要审查的代码块"
// @boundary: 当未配置 API Key 时，提示错误
export async function execute(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('未打开编辑器');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showErrorMessage('请选中要审查的代码块');
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

  // 构建工作流上下文
  const context: WorkflowContext = {
    document: editor.document,
    selection,
    workspaceRoot,
    apiKey,
    apiBaseUrl,
    modelId
  };

  // 执行工作流
  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '正在审查代码...',
      cancellable: false
    },
    async () => {
      return await executeCDDWorkflow(context);
    }
  );

  // 记录日志
  const now = new Date();
  await WorkScheduleRepo.addRecord(
    {
      date: now.toISOString().split('T')[0],
      time: now.toTimeString().split(' ')[0],
      role: '审查员',
      description: `工作流执行: ${result.executionPath.join(' → ')}`,
      duration: 0,
      dependencies: []
    },
    workspaceRoot
  );

  // 显示结果
  if (result.success) {
    if (result.reviewPassed) {
      vscode.window.showInformationMessage(`✅ ${result.message}`);
    } else {
      vscode.window.showInformationMessage(result.message);
    }
  } else {
    vscode.window.showErrorMessage(`❌ ${result.message}`);
  }
}
// @end
