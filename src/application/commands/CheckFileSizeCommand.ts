// @intent: 提供文件大小检查相关的 VSCode 命令

import * as vscode from 'vscode';
import { FileMetricsService } from '../../data/services/FileMetricsService';
import { extractIntentWithDependencies, checkDependencyBranchSize } from '../../data/services/IntentExtractor';
import * as path from 'path';

// @contract: execute() => Promise<void>
// @step: [获取工作区] 获取当前工作区根目录
// @step: [扫描项目] 调用 FileMetricsService.checkProjectFiles 扫描所有文件
// @step: [显示结果] 在输出面板显示结果
// @boundary: 当没有工作区时，显示错误提示
export async function execute() {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('请先打开一个工作区');
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  // 显示进度提示
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '正在扫描项目文件...',
      cancellable: false
    },
    async (progress) => {
      try {
        // 扫描项目
        const results = await FileMetricsService.checkProjectFiles(workspaceRoot, 400);

        // 格式化报告
        const report = FileMetricsService.formatReport(results);

        // 显示结果
        const outputChannel = vscode.window.createOutputChannel('CDD - File Metrics');
        outputChannel.clear();
        outputChannel.appendLine('=== 文件大小检查报告 ===\n');
        outputChannel.appendLine(report);
        outputChannel.show();

        // 显示通知
        if (results.length > 0) {
          const critical = results.filter((r: any) => r.lineCount > FileMetricsService.CRITICAL_THRESHOLD);
          if (critical.length > 0) {
            vscode.window.showWarningMessage(
              `发现 ${critical.length} 个严重超标文件，建议立即重构`,
              '查看报告'
            ).then(action => {
              if (action === '查看报告') {
                outputChannel.show();
              }
            });
          } else {
            vscode.window.showInformationMessage(`发现 ${results.length} 个文件建议重构`);
          }
        } else {
          vscode.window.showInformationMessage('✓ 所有文件都在推荐大小范围内');
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`扫描失败: ${error.message}`);
      }
    }
  );
}

// @contract: checkCurrentFileWithDependencies() => Promise<void>
// @step: [获取当前文件] 获取当前编辑器打开的文件
// @step: [提取依赖树] 调用 extractIntentWithDependencies
// @step: [检查大小] 调用 checkDependencyBranchSize
// @step: [显示结果] 在输出面板显示结果
// @boundary: 当没有打开文件时，显示错误提示
export async function checkCurrentFileWithDependencies() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('请先打开一个文件');
    return;
  }

  const filePath = editor.document.uri.fsPath;
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('请先打开一个工作区');
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '正在检查文件及其依赖...',
      cancellable: false
    },
    async (progress) => {
      try {
        // 提取依赖树
        const branch = await extractIntentWithDependencies(filePath, workspaceRoot, 2);

        // 检查大小
        const results = await checkDependencyBranchSize(branch, 400);

        // 格式化报告
        const fileName = path.basename(filePath);
        const report = FileMetricsService.formatReport(results);

        // 显示结果
        const outputChannel = vscode.window.createOutputChannel('CDD - File Metrics');
        outputChannel.clear();
        outputChannel.appendLine(`=== 文件依赖树大小检查: ${fileName} ===\n`);
        outputChannel.appendLine(report);
        outputChannel.show();

        // 显示通知
        if (results.length > 0) {
          vscode.window.showWarningMessage(
            `在依赖树中发现 ${results.length} 个文件需要重构`,
            '查看报告'
          ).then(action => {
            if (action === '查看报告') {
              outputChannel.show();
            }
          });
        } else {
          vscode.window.showInformationMessage('✓ 依赖树中所有文件都在推荐大小范围内');
        }
      } catch (error: any) {
        vscode.window.showErrorMessage(`检查失败: ${error.message}`);
      }
    }
  );
}
