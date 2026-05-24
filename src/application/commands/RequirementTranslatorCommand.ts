import * as vscode from 'vscode';
import { RequirementTranslatorVM } from '../roles/RequirementTranslatorVM';
import { ClaudeAPIService } from '../../data/services/ClaudeAPIService';
import { RequirementTranslatorContextManager } from '../context/RequirementTranslatorContextManager';

// @intent: 处理需求转译命令，将用户选中的自然语言需求转译为 CDD 格式的注释

// @contract: execute() => Promise<void>
// @step: [获取选区] 获取当前编辑器选中的文本作为需求描述
// @step: [读取配置] 读取 apiKey、apiBaseUrl、modelId 配置
// @step: [准备上下文] 调用 RequirementTranslatorContextManager.prepare
// @step: [转译] 调用 RequirementTranslatorVM.execute
// @step: [处理结果] 如果成功，将生成的 CDD 注释插入到选中文本的上方；如果失败，显示错误信息
// @boundary: 当未选中文本时，提示"请选中需求描述文本"
// @boundary: 当 API 返回 <<BACKTRACK>> 时，显示回溯原因并要求用户补充信息
// @boundary: 当未打开工作区时，提示"请先打开工作区"
export async function execute(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('未打开编辑器');
    return;
  }

  const selection = editor.selection;
  if (selection.isEmpty) {
    vscode.window.showErrorMessage('请选中需求描述文本');
    return;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('请先打开工作区');
    return;
  }

  // 获取选中的文本作为需求描述
  const intent = editor.document.getText(selection);

  const apiKey = vscode.workspace.getConfiguration('cdd').get<string>('apiKey') || '';
  if (!apiKey) {
    vscode.window.showErrorMessage('请先配置 API Key');
    return;
  }

  const apiBaseUrl = vscode.workspace.getConfiguration('cdd').get<string>('apiBaseUrl') || undefined;
  const modelId = vscode.workspace.getConfiguration('cdd').get<string>('modelId') || undefined;

  // 准备上下文
  const context = await RequirementTranslatorContextManager.prepare(
    intent,
    workspaceRoot,
    apiKey,
    apiBaseUrl,
    modelId
  );

  const apiService = new ClaudeAPIService();
  const translatorVM = new RequirementTranslatorVM(apiService);

  const result = await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '正在转译需求为 CDD 注释...',
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
    editBuilder.insert(insertPosition, commentText + '\n\n');
  });

  vscode.window.showInformationMessage('CDD 注释已生成，请审查后使用编译命令生成代码');
}
// @end
