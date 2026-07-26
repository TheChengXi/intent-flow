/**
 * @intent
 * VS Code 命令（右键菜单）：从意图扫描列表中移除选定文件夹。
 * 自动从 cdd.intents.roots 移除并触发全量重建。
 */

import * as vscode from 'vscode';
import { VSCodeDIContainer } from '../VSCodeDIContainer';

export const command = 'cdd.removeFromIntents';
export const description = '从意图目录移除';

/**
 * @contract
 * 将文件夹从 intent 扫描列表移除。
 * 输入：uri - 右键选中的文件夹 URI
 * 输出：void
 * 副作用：更新 cdd.intents.roots 设置，触发 .cdd/intents/ 重建
 */
export async function handler(uri: vscode.Uri): Promise<void> {
  const root = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
  if (!root) {
    vscode.window.showWarningMessage('CDD: 未打开工作区');
    return;
  }

  const folderPath = uri.fsPath;
  let relPath = folderPath.replace(root, '').replace(/^[/\\]/, '').replace(/\\/g, '/');
  if (!relPath) relPath = '.';

  const config = vscode.workspace.getConfiguration('cdd.intents');
  const current = config.get<string[]>('roots', []);

  if (!current.includes(relPath)) {
    vscode.window.showInformationMessage(`CDD: "${relPath}" 不在意图目录中`);
    return;
  }

  const updated = current.filter(r => r !== relPath);
  await config.update('roots', updated, vscode.ConfigurationTarget.Workspace);

  const msg = `CDD: "${relPath}" 已移除`;
  console.log(`[cdd.removeFromIntents] ${msg}`);
  vscode.window.showInformationMessage(msg);
}
