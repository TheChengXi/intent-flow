import * as vscode from 'vscode';
import { DryRunManager } from '../application/dryrun/DryRunManager';

/**
 * @intent
 * VSCode 状态栏控件，实时反映 Dry Run 模式的启用/禁用状态。点击触发切换命令，禁用时隐藏以释放状态栏空间
 */
export class DryRunStatusBarItem {
  private statusBarItem: vscode.StatusBarItem;
  private dryRunManager: DryRunManager;

  constructor(dryRunManager: DryRunManager) {
    this.dryRunManager = dryRunManager;
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
  }

  // @contract: initialize() => void
  // @step: [设置命令] 设置点击时触发的命令
  // @step: [监听状态变化] 注册 dryRunManager.onStateChange 监听器
  // @step: [初始化显示] 根据当前状态更新显示
  initialize(): void {
    // 设置点击命令
    this.statusBarItem.command = 'iflow.toggleDryRun';

    // 监听状态变化
    this.dryRunManager.onStateChange((enabled) => {
      this.updateDisplay(enabled);
    });

    // 初始化显示
    this.updateDisplay(this.dryRunManager.isEnabled());
  }

  // @contract: updateDisplay(enabled: boolean) => void
  // @step: [更新文本] 根据 enabled 状态更新状态栏文本
  // @step: [更新提示] 设置 tooltip
  // @step: [显示/隐藏] 启用时显示，禁用时隐藏
  // @boundary: 启用时显示 "🧪 Dry Run"
  // @boundary: 禁用时隐藏状态栏项
  private updateDisplay(enabled: boolean): void {
    if (enabled) {
      this.statusBarItem.text = '🧪 Dry Run';
      this.statusBarItem.tooltip = 'Dry Run mode is enabled. Click to disable.';
      this.statusBarItem.show();
    } else {
      this.statusBarItem.hide();
    }
  }

  // @contract: dispose() => void
  // @step: [销毁] 销毁状态栏项
  dispose(): void {
    this.statusBarItem.dispose();
  }
}
