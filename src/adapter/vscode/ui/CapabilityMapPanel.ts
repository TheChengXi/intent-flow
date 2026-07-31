/**
 * @intent
 * 能力地图 Webview 面板。管理面板生命周期、Webview 消息通信。读取 webview/index.html 作为 UI，运行时通过 webview.asWebviewUri 解析资源路径。意图包能力已废弃（saveGroups/loadGroups 消息处理已移除），面板仅服务文件夹意图浏览与展示。
 */


import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { VSCodeDIContainer } from '../VSCodeDIContainer';

export class CapabilityMapPanel {
  public static readonly viewType = 'cdd.capabilityMap';

  private panel: vscode.WebviewPanel | undefined;
  private context: vscode.ExtensionContext;
  private container: VSCodeDIContainer;
  private disposables: vscode.Disposable[] = [];

  static activePanel: CapabilityMapPanel | undefined;
  private static _commandsRegistered = false;

  /** 当前正在浏览的文件夹绝对路径 */
  private currentAbsFolder = '';

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.container = VSCodeDIContainer.getInstance();
  }

  async show(): Promise<void> {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      CapabilityMapPanel.viewType,
      '能力地图',
      vscode.ViewColumn.One,
      { enableScripts: true, retainContextWhenHidden: true }
    );

    this.panel.webview.html = await this.getWebviewContent();
    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
    this.panel.webview.onDidReceiveMessage(
      (msg) => this.handleMessage(msg),
      null,
      this.disposables
    );

    this.context.subscriptions.push(this.panel);

    CapabilityMapPanel.activePanel = this;

    // 注册快捷键命令（仅首次，避免 HMR 重复注册报错）
    if (!CapabilityMapPanel._commandsRegistered) {
      CapabilityMapPanel._commandsRegistered = true;
      this.context.subscriptions.push(
        vscode.commands.registerCommand('cdd.toggleSelectionMode', () => {
          CapabilityMapPanel.activePanel?.postMessage({ type: 'toggleSelectionMode' });
        })
      );
      this.context.subscriptions.push(
        vscode.commands.registerCommand('cdd.clearSelection', () => {
          CapabilityMapPanel.activePanel?.postMessage({ type: 'clearSelection' });
        })
      );
    }
  }

  /** 将用户输入的相对路径解析为工作区绝对路径 */
  private resolvePath(input: string): string {
    if (path.isAbsolute(input)) return input;
    const root = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;
    return root ? path.join(root, input.replace(/^\/+/, '')) : path.resolve(input);
  }

    /** Vite 开发服务器地址 */
  private static readonly DEV_SERVER = 'http://localhost:5173';

  /** 读取 webview HTML，替换资源路径为 webview URI */
  private async getWebviewContent(): Promise<string> {
    const isDev = this.context.extensionMode === vscode.ExtensionMode.Development;

    if (isDev) {
      // 开发模式：必须连 Vite Dev Server
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);
      const url = this.getDevServerUrl('/');
      console.log('[CapabilityMap] 尝试连接 Vite Dev Server:', url);
      let resp;
      try {
        resp = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!resp || !resp.ok) {
        const status = resp ? 'HTTP ' + resp.status : '无响应';
        throw new Error('Vite Dev Server 连接失败 (' + status + ')\n请确认终端已运行:\n  cd src/adapter/vscode/ui/webview\n  npx vite --config vite.config.mts');
      }
      console.log('[CapabilityMap] ✅ 已连接 Vite Dev Server');
      let devHtml = await resp.text();
      // Vite 返回的路径有 ./src/main.js 和 /src/main.js 两种，统一转成 Dev Server URL
      const re = new RegExp('(src|href)="(\.?/[^"]+)"', 'g');
      devHtml = devHtml.replace(re, (_, attr, file) => {
        const p = file.startsWith('./') ? file.slice(1) : file;
        return attr + '="' + this.getDevServerUrl(p) + '"';
      });
      return devHtml;
    }

    // 生产模式：读取构建产物
    const webviewRoot = path.join(this.context.extensionPath, 'dist', 'webview');
    const htmlPath = path.join(webviewRoot, 'index.html');
    if (!fs.existsSync(htmlPath)) {
      return this.buildErrorPage(
        '❌ 构建产物缺失',
        '未找到 dist/webview/index.html，请先运行：',
        'npm run compile:vscode',
        ''
      );
    }
    let html = fs.readFileSync(htmlPath, 'utf-8');
    const uriBase = this.panel!.webview.asWebviewUri(vscode.Uri.file(webviewRoot));
    html = html.replace(/(href|src)="(\.[^"]+)"/g, (_, attr, file) => {
      return `${attr}="${uriBase}/${file.replace('./', '')}"`;
    });
    return html;
  }

  /** 生成错误提示页 */
  private buildErrorPage(title: string, hint: string, command: string, detail: string): string {
    return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>能力地图</title>
<style>
body {
  font-family: var(--vscode-font-family, sans-serif);
  background: var(--vscode-editor-background, #1e1e1e);
  color: var(--vscode-editor-foreground, #ccc);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  height: 100vh; margin: 0; padding: 2rem; text-align: center; gap: 0.5rem;
}
h1 { font-size: 1.4rem; font-weight: 600; margin-bottom: 0.5rem; }
p { font-size: 0.9rem; color: var(--vscode-descriptionForeground, #888); max-width: 30rem; }
code {
  background: var(--vscode-textBlockQuote-background, #2a2d2e);
  padding: 0.8rem 1.2rem; border-radius: 0.3rem; font-size: 0.85rem;
  white-space: pre; display: inline-block; text-align: left;
  border: 1px solid var(--vscode-panel-border, #3c3c3c);
  margin: 0.8rem 0;
}
.detail { font-size: 0.75rem; color: #e06c75; }
</style>
</head>
<body>
<h1>${title}</h1>
<p>${hint}</p>
<code>${command}</code>
<p class="detail">${detail}</p>
</body>
</html>`;
  }

  private getDevServerUrl(pathname: string): string {
    const base = CapabilityMapPanel.DEV_SERVER;
    return base + pathname;
  }

  // ==================== 消息处理 ====================

  private async handleMessage(msg: any): Promise<void> {
    if (!this.panel) return;
    const core = this.container.getCore();

    try {
      switch (msg.type) {
        case 'selectFolderDialog': {
          const folderUri = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            openLabel: '选择文件夹',
            title: '选择能力地图根目录',
          });
          if (!folderUri || folderUri.length === 0) break;
          this.currentAbsFolder = folderUri[0].fsPath;
          // 通知 webview 更新路径显示
          this.postMessage({ type: 'folderPathUpdated', folder: this.currentAbsFolder });
          // 直接加载
          const dialogResult = await core.listFolderIntentsUseCase.execute(this.currentAbsFolder);
          this.postMessage({
            type: 'folderData',
            data: {
              folder: dialogResult.folder,
              subdirectories: dialogResult.subdirectories,
              files: dialogResult.files,
              groups: [],
            },
          });
          break;
        }

        case 'selectFolder':
        case 'openSubfolder': {
          this.currentAbsFolder = this.resolvePath(msg.folder);
          const result = await core.listFolderIntentsUseCase.execute(this.currentAbsFolder);

          this.postMessage({
            type: 'folderData',
            data: {
              folder: result.folder,
              subdirectories: result.subdirectories,
              files: result.files,
              groups: [],
            },
          });
          break;
        }

        case 'doubleClickGroup': {
          const entryFile = path.join(this.currentAbsFolder, msg.entryFile);
          const result = await core.traceDependencyChainUseCase.execute({ entryFile });
          this.postMessage({ type: 'traceData', data: result });
          break;
        }

        case 'openFile': {
          const fileUri = vscode.Uri.file(msg.path);
          vscode.window.showTextDocument(fileUri);
          break;
        }

        case 'hoverFile': {
          const absFile = path.join(this.currentAbsFolder, msg.fileName);
          try {
            const content = await core.fileRepo.readFile(absFile);
            const m = content.match(/@intent[:\s]+(.+)/);
            this.postMessage({
              type: 'intentDetail',
              fileName: msg.fileName,
              intent: m?.[1]?.trim() ?? null,
            });
          } catch {
            this.postMessage({ type: 'intentDetail', fileName: msg.fileName, intent: null });
          }
          break;
        }

        default:
          console.warn('[CapabilityMap] 未知消息类型: ' + msg.type);
      }
    } catch (err) {
      this.postMessage({
        type: 'saveResult',
        success: false,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private postMessage(message: any): void {
    this.panel?.webview.postMessage(message);
  }

  private dispose(): void {
    this.panel = undefined;
    for (const d of this.disposables) d.dispose();
    this.disposables = [];
  }
}
