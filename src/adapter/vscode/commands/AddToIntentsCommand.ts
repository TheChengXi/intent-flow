/**
 * @intent
 * VS Code 命令（右键菜单）：将选定文件夹添加到意图扫描列表。
 * 自动写入 iflow.intents.roots 设置并触发全量重建。
 */

import * as vscode from 'vscode';
import { VSCodeDIContainer } from '../VSCodeDIContainer';

export const command = 'iflow.addToIntents';
export const description = '添加到此意图目录';

/**
 * @contract
 * 将文件夹添加到 intent 扫描列表。
 * 输入：uri - 右键选中的文件夹 URI
 * 输出：void
 * 副作用：更新 iflow.intents.roots 设置，触发 .intentflow/intents/ 重建
 */
export async function handler(uri: vscode.Uri): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
  if (!root) {
    vscode.window.showWarningMessage('IntentFlow: 未打开工作区');
    return;
  }

  const folderPath = uri.fsPath;
  // 计算相对工作区的路径（根目录用 '.' 表示）
  let relPath = folderPath.replace(root, '').replace(/^[/\\]/, '').replace(/\\/g, '/');
  if (!relPath) relPath = '.';

  const config = vscode.workspace.getConfiguration('iflow.intents');
  const current = config.get<string[]>('roots', []);

  if (current.includes(relPath)) {
    vscode.window.showInformationMessage(`IntentFlow: "${relPath}" 已在意图目录中`);
    return;
  }

  // 更新设置
  await config.update('roots', [...current, relPath], vscode.ConfigurationTarget.Workspace);

  // 触发重建
  const excludePatterns = config.get<string[]>('exclude', []);
  const container = VSCodeDIContainer.getInstance();
  const useCase = container.getCore().projectIntentsToFilesUseCase;

  vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `IntentFlow: 正在扫描 "${relPath}"…`,
      cancellable: false,
    },
    async () => {
      try {
        const result = await useCase.fullSync({
          sourceRoot: root,
          sourceRoots: [...current, relPath],
          excludePatterns,
        });
        const msg = `IntentFlow: "${relPath}" 已添加 — ${result.filesCreated} 创建, ${result.filesUpdated} 更新, ${result.filesDeleted} 删除`;
        vscode.window.showInformationMessage(msg);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        vscode.window.showErrorMessage(`IntentFlow: 扫描失败 — ${msg}`);
      }
    }
  );
}
