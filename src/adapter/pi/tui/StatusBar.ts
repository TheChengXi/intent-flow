/**
 * @intent 仪表盘底部状态栏组件。纯展示，无交互状态。
 * 根据运行摘要显示当前状态 + 右侧快捷键提示。
 * 组件自治：只接收数据渲染，不管理任何可变状态。
 */

import { visibleWidth } from '@earendil-works/pi-tui';
import type { AgentRunState } from './AgentRunTracker';
import { statusIcon, type ThemeFg } from './tui-utils';

export class StatusBar {
  /**
   * 渲染底部状态栏。
   * @returns 单行字符串（不含边框，由调用方包裹 │ │）
   */
  render(
    runs: AgentRunState[],
    summary: { total: number; running: number; completed: number; failed: number; aborted: number },
    innerWidth: number,
    themeFg: ThemeFg,
  ): string {
    // 左侧：状态文本
    let statusLine = '';
    if (summary.total === 0) {
      statusLine = themeFg('dim', '待命中');
    } else {
      const runningNames = runs.filter(r => r.status === 'running').map(r => r.agent);
      if (runningNames.length > 0) {
        statusLine += `${statusIcon('running', themeFg)} ${runningNames.join(', ')}`;
      }
      if (summary.completed > 0 && runningNames.length === 0) {
        statusLine += `${statusIcon('completed', themeFg)} 完成`;
      }
    }

    // 右侧：快捷键提示
    const keybindings = themeFg('dim', 'q关闭  ↑↓  Enter日志  Tab切换');

    // 左右拼接到一行内
    const content = `${statusLine}${' '.repeat(Math.max(0, innerWidth - visibleWidth(statusLine) - visibleWidth(keybindings)))}${keybindings}`;
    return content;
  }
}
