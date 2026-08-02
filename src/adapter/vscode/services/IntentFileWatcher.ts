/**
 * @intent
 * VS Code 文件监听器，监听工作区文件变更并触发 .intentflow/intents/ 投射更新。
 * 激活时执行全量同步，之后监听文件增/删/改做增量更新。
 * 避免冗余触发：同一个文件 500ms 内的多次变更只执行一次。
 */

import * as vscode from 'vscode';
import { ProjectIntentsToFilesUseCase } from '../../../application/useCases/ProjectIntentsToFilesUseCase';

export class IntentFileWatcher {
  private useCase: ProjectIntentsToFilesUseCase;
  private sourceRoot: string;
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  private static readonly DEBOUNCE_MS = 500;

  constructor(useCase: ProjectIntentsToFilesUseCase, sourceRoot: string) {
    this.useCase = useCase;
    this.sourceRoot = sourceRoot;
  }

  /** 从 VS Code 设置读取排除模式 */
  private getExcludePatterns(): string[] {
    return vscode.workspace.getConfiguration('iflow.intents').get<string[]>('exclude', []);
  }

  /** 从 VS Code 设置读取已选中的源文件夹列表 */
  private getSourceRoots(): string[] {
    return vscode.workspace.getConfiguration('iflow.intents').get<string[]>('roots', []);
  }

  /**
   * @contract
   * 启动监听：全量同步一次 + 注册文件变更事件。
   * 输入：context - VS Code 扩展上下文（用于注册订阅）
   * 副作用：吞掉所有侦听错误，不影响 VS Code 稳定性
   */
  async start(context: vscode.ExtensionContext): Promise<void> {
    const sourceRoots = this.getSourceRoots();

    // 1. 全量同步（仅当用户已指定过文件夹时才扫）
    if (sourceRoots.length > 0) {
      const excludePatterns = this.getExcludePatterns();
      try {
        const result = await this.useCase.fullSync({ sourceRoot: this.sourceRoot, sourceRoots, excludePatterns });
        console.log(`[IntentFileWatcher] 全量同步完成: ${result.filesCreated} 创建, ${result.filesUpdated} 更新, ${result.filesDeleted} 删除`);
      } catch (err) {
        console.error('[IntentFileWatcher] 全量同步失败:', err);
      }
    } else {
      console.log('[IntentFileWatcher] 未配置源文件夹，跳过全量同步（右键文件夹 → 添加到此意图目录）');
    }

    // 监听设置变更（排除模式或已选文件夹），触发重扫
    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('iflow.intents')) {
          const newPatterns = this.getExcludePatterns();
          const newRoots = this.getSourceRoots();
          this.useCase.fullSync({ sourceRoot: this.sourceRoot, sourceRoots: newRoots, excludePatterns: newPatterns }).catch(err => {
            console.error('[IntentFileWatcher] 设置变更后重扫失败:', err);
          });
        }
      })
    );

    // 2. 文件创建/删除
    const watcher = vscode.workspace.createFileSystemWatcher('**/*');
    context.subscriptions.push(watcher);

    watcher.onDidCreate((uri) => {
      if (this.isUnderRoot(uri)) {
        this.debounceSync(uri.fsPath);
      }
    });

    watcher.onDidChange((uri) => {
      if (this.isUnderRoot(uri)) {
        this.debounceSync(uri.fsPath);
      }
    });

    watcher.onDidDelete((uri) => {
      if (this.isUnderRoot(uri)) {
        this.debounceRemove(uri.fsPath);
      }
    });

    // 3. 保存时触发（捕获编辑器保存的变更）
    context.subscriptions.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        const uri = doc.uri;
        if (uri.scheme === 'file' && this.isUnderRoot(uri)) {
          this.debounceSync(uri.fsPath);
        }
      })
    );

    console.log('[IntentFileWatcher] 文件监听已启动');
  }

  /** 判断文件是否在 sourceRoot 下 */
  private isUnderRoot(uri: vscode.Uri): boolean {
    return uri.fsPath.startsWith(this.sourceRoot);
  }

  /** 防抖：多次变更合并为一次同步 */
  private debounceSync(filePath: string): void {
    const key = `sync:${filePath}`;
    const existing = this.debounceTimers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(key);
      // 跳过 .intentflow/ 下的文件（避免循环触发）
      const relPath = filePath.replace(this.sourceRoot, '').replace(/^[/\\]/, '');
      if (relPath.startsWith('.intentflow')) return;

      try {
        await this.useCase.syncFile({
          sourceRoot: this.sourceRoot,
          filePath,
          sourceRoots: this.getSourceRoots(),
          excludePatterns: this.getExcludePatterns(),
        });
      } catch (err) {
        console.error(`[IntentFileWatcher] syncFile 失败: ${filePath}`, err);
      }
    }, IntentFileWatcher.DEBOUNCE_MS);

    this.debounceTimers.set(key, timer);
  }

  /** 防抖：文件删除后的处理 */
  private debounceRemove(filePath: string): void {
    const key = `remove:${filePath}`;
    const existing = this.debounceTimers.get(key);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      this.debounceTimers.delete(key);
      const relPath = filePath.replace(this.sourceRoot, '').replace(/^[/\\]/, '');
      if (relPath.startsWith('.intentflow')) return;

      try {
        await this.useCase.removeFile({
          sourceRoot: this.sourceRoot,
          filePath,
          sourceRoots: this.getSourceRoots(),
          excludePatterns: this.getExcludePatterns(),
        });
      } catch (err) {
        console.error(`[IntentFileWatcher] removeFile 失败: ${filePath}`, err);
      }
    }, IntentFileWatcher.DEBOUNCE_MS);

    this.debounceTimers.set(key, timer);
  }
}
