/**
 * @intent
 * VS Code 命令：手动触发 .intentflow/intents/ 全量重建。
 * 注册为 iflow.projectIntents，从 VSCodeDIContainer 获取 UseCase 执行全量同步。
 * 在 VS Code 输出面板显示执行结果。
 */

import * as vscode from 'vscode';
import { VSCodeDIContainer } from '../VSCodeDIContainer';

export const command = 'iflow.projectIntents';
export const description = '重建 .intentflow/intents/ 意图投射目录';

/**
 * @contract
 * 执行全量意图投射同步。
 * 输入：无
 * 输出：void（在输出面板打印结果）
 * 副作用：写 .intentflow/intents/ 目录树
 */
export async function handler(): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
  if (!root) {
    vscode.window.showWarningMessage('IntentFlow: 未打开工作区，无法投射意图');
    return;
  }

  const container = VSCodeDIContainer.getInstance();
  const useCase = container.getCore().projectIntentsToFilesUseCase;

  const config = vscode.workspace.getConfiguration('iflow.intents');
  const sourceRoots = config.get<string[]>('roots', []);
  const excludePatterns = config.get<string[]>('exclude', []);

  if (sourceRoots.length === 0) {
    vscode.window.showWarningMessage('IntentFlow: 未配置源文件夹，请在文件管理器右键文件夹 → 添加到此意图目录');
    return;
  }

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: 'IntentFlow: 正在重建意图投射目录…',
      cancellable: false,
    },
    async () => {
      try {
        const result = await useCase.fullSync({ sourceRoot: root, sourceRoots, excludePatterns });
        const msg = `IntentFlow: 意图投射完成 — ${result.filesCreated} 创建, ${result.filesUpdated} 更新, ${result.filesDeleted} 删除`;
        console.log(`[iflow.projectIntents] ${msg}`);
        vscode.window.showInformationMessage(msg);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[iflow.projectIntents] 全量同步失败:', err);
        vscode.window.showErrorMessage(`IntentFlow: 意图投射失败 — ${msg}`);
      }
    }
  );
}
