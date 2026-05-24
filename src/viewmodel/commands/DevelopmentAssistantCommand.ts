// @intent: 提供流程式开发助手命令，引导用户使用 5 个设计阶段

import * as vscode from 'vscode';
import { DevelopmentAssistantContextManager } from '../context/DevelopmentAssistantContextManager';

// @contract: execute() => Promise<void>
// @step: [显示阶段选择] 显示 5 个设计阶段供用户选择
// @step: [提供说明] 显示每个阶段的说明和使用方式
export async function execute(): Promise<void> {
  const message = `🚀 CDD 流程式开发助手

请在 **聊天面板** 中使用流程式开发助手：

**5 个设计阶段**：
1️⃣ 需求结构化 - 收集业务需求并结构化
2️⃣ 架构设计 - 确定技术栈和模块划分
3️⃣ Model 设计 - 设计数据模型并生成代码
4️⃣ ViewModel 设计 - 设计业务逻辑并生成骨架
5️⃣ View 设计 - 设计界面并生成骨架

**使用方式**：
1. 打开聊天面板（Ctrl+Alt+I）
2. 输入：@cdd /structure 开始需求结构化
3. 完成后依次进入下一阶段

**示例**：
  @cdd /structure 我想做一个记账软件
  @cdd /architecture 继续架构设计
  @cdd /model-design 继续 Model 设计
  @cdd /viewmodel-design 继续 ViewModel 设计
  @cdd /view-design 继续 View 设计

详细说明请查看：_source/prompts/WORKFLOW-README.md`;

  const action = await vscode.window.showInformationMessage(
    message,
    '打开聊天面板',
    '查看文档',
    '清除会话'
  );

  if (action === '打开聊天面板') {
    vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
  } else if (action === '查看文档') {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      const docPath = vscode.Uri.joinPath(
        workspaceFolders[0].uri,
        '_source',
        'prompts',
        'WORKFLOW-README.md'
      );
      vscode.commands.executeCommand('markdown.showPreview', docPath);
    }
  } else if (action === '清除会话') {
    await clearSession();
  }
}
// @end

// @contract: clearSession() => Promise<void>
// @step: [获取工作区] 获取当前工作区根路径
// @step: [清除会话] 调用 DevelopmentAssistantContextManager.clearSession
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

    await DevelopmentAssistantContextManager.clearSession(workspaceRoot);
    vscode.window.showInformationMessage('开发助手会话已清除');
  } catch (error: any) {
    vscode.window.showErrorMessage(`清除会话失败: ${error.message}`);
  }
}
// @end
