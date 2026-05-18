// @intent: 提供产品经理对话命令，引导用户使用聊天框

import * as vscode from 'vscode';
import { ProductManagerContextManager } from '../context/ProductManagerContextManager';

// @contract: execute() => Promise<void>
// @step: [显示提示] 提示用户在聊天框中使用产品经理
// @step: [提供示例] 显示使用示例
export async function execute(): Promise<void> {
  const message = `💼 产品经理对话

请在 **聊天面板** 中使用产品经理功能：

1. 打开聊天面板（Ctrl+Alt+I 或点击侧边栏聊天图标）
2. 输入：@cdd /pm 你的需求

示例：
  @cdd /pm 我想做一个记账软件

产品经理会通过多轮对话帮你将模糊需求转化为清晰的需求文档。`;

  const action = await vscode.window.showInformationMessage(
    message,
    '打开聊天面板',
    '清除会话'
  );

  if (action === '打开聊天面板') {
    vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
  } else if (action === '清除会话') {
    await clearSession();
  }
}
// @end

// @contract: clearSession() => Promise<void>
// @step: [获取工作区] 获取当前工作区根路径
// @step: [清除会话] 调用 ProductManagerContextManager.clearSession
// @step: [显示消息] 显示清除成功消息
// @boundary: 当工作区为空时，提示用户打开工作区
export async function clearSession(): Promise<void> {
  try {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('请先打开一个工作区');
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    await ProductManagerContextManager.clearSession(workspaceRoot);
    vscode.window.showInformationMessage('产品经理会话已清除');
  } catch (error: any) {
    vscode.window.showErrorMessage(`清除会话失败: ${error.message}`);
  }
}
// @end
