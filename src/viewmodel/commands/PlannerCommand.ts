// @intent: 提供 /planner 命令，扫描项目架构并展示结构化视图

import * as vscode from 'vscode';
import { PlannerVM } from '../roles/PlannerVM';

// @contract: execute(scope?: string) => Promise<void>
// @step: [获取工作区] 获取当前工作区根路径
// @step: [调用 PlannerVM] 调用 PlannerVM.generateArchitectureView 生成架构视图
// @step: [格式化输出] 调用 PlannerVM.formatArchitectureView 格式化为可读文本
// @step: [显示结果] 在输出面板或 Markdown 预览中显示结果
// @boundary: 当工作区为空时，提示用户打开工作区
// @boundary: 当扫描失败时，显示错误信息
export async function execute(scope?: string): Promise<void> {
  try {
    // 获取工作区根路径
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      vscode.window.showErrorMessage('请先打开一个工作区');
      return;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;

    // 显示进度提示
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: scope ? `正在扫描模块: ${scope}` : '正在扫描项目架构',
        cancellable: false
      },
      async (progress) => {
        progress.report({ increment: 0 });

        // 生成架构视图
        const view = await PlannerVM.generateArchitectureView(workspaceRoot, scope);

        progress.report({ increment: 50 });

        // 格式化输出
        const formattedOutput = PlannerVM.formatArchitectureView(view);

        progress.report({ increment: 100 });

        // 显示结果
        await showArchitectureView(formattedOutput, scope);
      }
    );
  } catch (error: any) {
    vscode.window.showErrorMessage(`架构扫描失败: ${error.message}`);
    console.error('[PlannerCommand] 执行失败:', error);
  }
}
// @end

// @contract: showArchitectureView(content: string, scope?: string) => Promise<void>
// @step: [创建文档] 创建一个新的 Markdown 文档
// @step: [写入内容] 将格式化的架构视图写入文档
// @step: [显示文档] 在编辑器中显示文档
// @boundary: 当文档创建失败时，回退到输出面板显示
async function showArchitectureView(content: string, scope?: string): Promise<void> {
  try {
    // 创建一个新的 Markdown 文档
    const doc = await vscode.workspace.openTextDocument({
      content,
      language: 'markdown'
    });

    // 在编辑器中显示
    await vscode.window.showTextDocument(doc, {
      preview: true,
      viewColumn: vscode.ViewColumn.Beside
    });
  } catch (error) {
    // 回退到输出面板
    const outputChannel = vscode.window.createOutputChannel('CDD Planner');
    outputChannel.clear();
    outputChannel.appendLine(content);
    outputChannel.show();
  }
}
// @end
