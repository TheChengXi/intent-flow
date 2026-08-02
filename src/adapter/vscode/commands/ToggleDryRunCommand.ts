import * as vscode from 'vscode';
import { DryRunManager } from '../application/dryrun/DryRunManager';

/**
 * @intent
 * VSCode 命令处理器，将 iflow.dryrun-toggle 命令绑定到 DryRunManager.toggle()，并通过 VSCode 通知机制向用户反馈切换结果
 */
export class ToggleDryRunCommand {
  private dryRunManager: DryRunManager;

  constructor(dryRunManager: DryRunManager) {
    this.dryRunManager = dryRunManager;
  }

  // @contract: execute() => Promise<void>
  // @step: [切换状态] 调用 dryRunManager.toggle()
  // @step: [显示通知] 根据新状态显示相应的通知消息
  async execute(): Promise<void> {
    const enabled = this.dryRunManager.toggle();
    this.showNotification(enabled);
  }

  // @contract: showNotification(enabled: boolean) => void
  // @step: [构建消息] 根据 enabled 状态构建通知消息
  // @step: [显示通知] 使用 vscode.window.showInformationMessage 显示
  // @boundary: 启用时显示 "Dry Run mode enabled..."
  // @boundary: 禁用时显示 "Dry Run mode disabled..."
  private showNotification(enabled: boolean): void {
    if (enabled) {
      vscode.window.showInformationMessage(
        'Dry Run mode enabled. API calls will be intercepted and saved to .intentflow/test-output/'
      );
    } else {
      vscode.window.showInformationMessage(
        'Dry Run mode disabled. API calls will be sent normally.'
      );
    }
  }
}
