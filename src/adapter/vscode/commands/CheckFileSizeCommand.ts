/**
 * @intent
 * 导出两个 VSCode 命令入口：execute（项目范围扫描）和 checkCurrentFileWithDependencies（对当前文件执行大小检查）。已移除 workspaceRoot 参数构造。
 */

import * as vscode from 'vscode';
import { VSCodeDIContainer } from '../VSCodeDIContainer';



export async function execute(): Promise<void> {
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('未打开工作区');
    return;
  }

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '正在扫描项目文件...',
      cancellable: false
    },
    async (_progress) => {
      try {
        // TODO: Implement project-wide file size check
        // For now, just show a placeholder message
        vscode.window.showInformationMessage('项目文件大小检查功能待完善');

      } catch (error: any) {
        vscode.window.showErrorMessage(`❌ 扫描失败：${error.message}`);
      }
    }
  );
}

export async function checkCurrentFileWithDependencies(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showErrorMessage('请先打开一个文件');
    return;
  }

  const container = VSCodeDIContainer.getInstance();

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '正在检查文件大小...',
      cancellable: false
    },
    async (_progress) => {
      try {
        const checkFileSizeUseCase = container.getCore().checkFileSizeUseCase;
        const results = await checkFileSizeUseCase.execute({
          filePath: editor.document.uri.fsPath,
          threshold: 400
        });

        const outputChannel = vscode.window.createOutputChannel('CDD - 文件大小检查');
        outputChannel.clear();
        outputChannel.appendLine('=== 文件大小检查报告 ===\n');

        const oversizedFiles = results.filter(r => r.needsRefactor);

        if (oversizedFiles.length === 0) {
          outputChannel.appendLine('✓ 文件在推荐大小范围内');
        } else {
          outputChannel.appendLine(`发现 ${oversizedFiles.length} 个文件超标：\n`);
          oversizedFiles.forEach(file => {
            outputChannel.appendLine(`${file.filePath}`);
            outputChannel.appendLine(`  超出：${file.exceedLines} 行`);
            outputChannel.appendLine(`  建议：拆分为更小的模块\n`);
          });
        }

        outputChannel.show();

        if (oversizedFiles.length > 0) {
          vscode.window.showWarningMessage(`文件超标 ${oversizedFiles[0].exceedLines} 行，建议重构`);
        } else {
          vscode.window.showInformationMessage('✓ 文件在推荐大小范围内');
        }

      } catch (error: any) {
        vscode.window.showErrorMessage(`❌ 检查失败：${error.message}`);
      }
    }
  );
}
// @end
