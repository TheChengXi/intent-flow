import * as vscode from 'vscode';
import { DryRunManager } from '../application/dryrun/DryRunManager';

/**
 * @intent
 * VSCode 输出面板组件，订阅 DryRunManager 的拦截/错误事件并格式化输出到面板。文件保存失败时显示完整内容作为降级方案
 */
export class DryRunOutputChannel {
  private outputChannel: vscode.OutputChannel;
  private dryRunManager: DryRunManager;

  constructor(dryRunManager: DryRunManager) {
    this.dryRunManager = dryRunManager;
    this.outputChannel = vscode.window.createOutputChannel('IntentFlow Dry Run');
  }

  // @contract: initialize() => void
  // @step: [监听拦截事件] 注册 dryRunManager.onIntercept 监听器
  // @step: [监听错误事件] 注册 dryRunManager.onError 监听器
  initialize(): void {
    // 监听拦截事件
    this.dryRunManager.onIntercept((filePath) => {
      this.showInterceptInfo(filePath);
    });

    // 监听错误事件
    this.dryRunManager.onError((error, content) => {
      this.showError(error, content);
    });
  }

  // @contract: showInterceptInfo(filePath: string) => void
  // @step: [输出信息] 在输出面板显示拦截成功信息
  // @step: [显示面板] 自动显示输出面板（不抢焦点）
  // @boundary: 信息格式：[Dry Run] Request intercepted and saved to: {filePath}
  private showInterceptInfo(filePath: string): void {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    this.outputChannel.appendLine(`[${timestamp}] [Dry Run] Request intercepted and saved to: ${filePath}`);
    this.outputChannel.show(true); // true = 不抢焦点
  }

  // @contract: showError(error: Error, content?: string) => void
  // @step: [输出错误] 在输出面板显示错误信息
  // @step: [输出内容] 如果 content 存在，显示完整内容作为降级方案
  // @step: [显示面板] 自动显示输出面板
  // @step: [弹出通知] 使用 vscode.window.showErrorMessage 显示错误通知
  // @boundary: 降级处理：文件保存失败时显示完整内容
  private showError(error: Error, content?: string): void {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    this.outputChannel.appendLine(`[${timestamp}] [Dry Run] Error: ${error.message}`);

    if (content) {
      this.outputChannel.appendLine('');
      this.outputChannel.appendLine('=== Intercepted Content (Fallback) ===');
      this.outputChannel.appendLine(content);
      this.outputChannel.appendLine('=== End of Content ===');
      this.outputChannel.appendLine('');
    }

    this.outputChannel.show(true);

    // 显示错误通知
    vscode.window.showErrorMessage(
      `Dry Run: Failed to save file - ${error.message}. Content displayed in output panel.`
    );
  }

  // @contract: dispose() => void
  // @step: [销毁] 销毁输出面板
  dispose(): void {
    this.outputChannel.dispose();
  }
}
