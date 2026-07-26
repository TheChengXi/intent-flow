/**
 * @intent
 * VS Code 命令（右键菜单）：从意图扫描中排除选定文件夹。
 * - 如果文件夹在 roots 列表中 → 从 roots 移除
 * - 如果文件夹不在 roots 列表中 → 追加到 exclude 排除列表
 * 触发全量重建使改动生效。
 */

import * as vscode from 'vscode';
import { VSCodeDIContainer } from '../VSCodeDIContainer';

export const command = 'cdd.removeFromIntents';
export const description = '从意图目录移除';

/**
 * @contract
 * 将文件夹从 intent 扫描中排除。
 * 输入：uri - 右键选中的文件夹 URI
 * 输出：void
 * 副作用：更新 cdd.intents.roots 或 cdd.intents.exclude，触发重扫
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
  const roots = config.get<string[]>('roots', []);
  const exclude = config.get<string[]>('exclude', []);

  if (roots.includes(relPath)) {
    // 情况 A：在 roots 列表中 → 直接移除
    const updated = roots.filter(r => r !== relPath);
    await config.update('roots', updated, vscode.ConfigurationTarget.Workspace);
    vscode.window.showInformationMessage(`CDD: "${relPath}" 已从扫描列表移除`);
  } else {
    // 情况 B：不在 roots 列表中 → 追加到 exclude
    const pattern = `**/${relPath}/**`;
    if (exclude.includes(pattern)) {
      vscode.window.showInformationMessage(`CDD: "${relPath}" 已在排除列表中`);
      return;
    }
    await config.update('exclude', [...exclude, pattern], vscode.ConfigurationTarget.Workspace);
    vscode.window.showInformationMessage(`CDD: "${relPath}" 已加入排除列表`);
  }
}
