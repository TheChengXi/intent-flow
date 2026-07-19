/**
 * @intent
 * VSCode 命令：打开能力地图面板。
 * 注册为 cdd.openCapabilityMap，创建 Webview 面板展示当前项目的能力地图。
 */

import * as vscode from 'vscode';
import { CapabilityMapPanel } from '../ui/CapabilityMapPanel';

export const command = 'cdd.openCapabilityMap';
export const description = '打开能力地图面板';

/**
 * @contract
 * 创建并显示能力地图 Webview 面板。
 * 输入：context - VSCode 扩展上下文（用于注册面板资源）
 * 输出：void
 * 副作用：创建 WebviewPanel 并注册到 context.subscriptions
 */
export async function handler(context: vscode.ExtensionContext) {
  const panel = new CapabilityMapPanel(context);
  await panel.show();
}
