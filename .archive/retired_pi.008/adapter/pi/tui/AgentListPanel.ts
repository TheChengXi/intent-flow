/**
 * @intent Agent 列表面板组件。管理列表显示、键盘选择导航、选中高亮。
 * 组件自治：自己管理 selectedIndex 和 scrollOffset，外部只需传入数据和焦点状态。
 * 通过回调向外发送 kill/retry 指令。
 */

import { matchesKey, Key, truncateToWidth } from '@earendil-works/pi-tui';
import type { AgentRunState } from './AgentRunTracker';
import { fmtDuration, fmtCost, statusIcon, trunc, type ThemeFg } from './tui-utils';

// ==================== 常量 ====================

const MAX_VISIBLE_AGENTS = 12;

// ==================== 接口 ====================

export interface AgentListPanelConfig {
  /** 终止运行的回调（传入 toolCallId） */
  onKill?: (toolCallId: string) => void;
  /** 重试运行的回调（传入 toolCallId） */
  onRetry?: (toolCallId: string) => void;
}

// ==================== 组件 ====================

export class AgentListPanel {
  /** 当前选中的 agent 在列表中的索引 */
  private selectedIndex = 0;
  /** agent 列表滚动偏移 */
  private scrollOffset = 0;

  constructor(private config: AgentListPanelConfig = {}) {}

  /** 重置选中到第一项（在 runs 变更时调用） */
  resetSelection(): void {
    this.selectedIndex = 0;
    this.scrollOffset = 0;
  }

  /** 选中最后一项（新 agent 加入时跳到它） */
  selectLast(total: number): void {
    if (total === 0) return;
    this.selectedIndex = total - 1;
    this.ensureVisible();
  }

  // ==================== 键盘事件 ====================

  /**
   * 处理列表键盘事件。
   * @returns 是否需要切换到日志视图（enter 按下时）
   */
  handleInput(data: string, total: number): boolean {
    if (total === 0) return false;

    if (matchesKey(data, Key.up)) {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1);
      this.ensureVisible();
    } else if (matchesKey(data, Key.down)) {
      this.selectedIndex = Math.min(total - 1, this.selectedIndex + 1);
      this.ensureVisible();
    } else if (matchesKey(data, Key.enter)) {
      return true; // 切换到日志视图
    } else if (matchesKey(data, 'k') || data === 'K') {
      // 终止运行中的 agent
      // 不在这里获取 runs，通过事件发给外部处理
      return false; // kill 动作由外部回调处理
    } else if (matchesKey(data, 'r') || data === 'R') {
      // 重试失败的 agent
      return false; // retry 动作由外部回调处理
    }

    return false;
  }

  /** 获取当前选中的索引（外部需要据此获取对应的 run） */
  getSelectedIndex(): number {
    return this.selectedIndex;
  }

  /** 外部触发 kill 操作时调用，返回被操作的 toolCallId */
  handleKill(runs: AgentRunState[]): string | null {
    if (runs.length === 0) return null;
    const run = runs[this.selectedIndex];
    if (run && run.status === 'running' && this.config.onKill) {
      this.config.onKill(run.toolCallId);
    }
    return run?.toolCallId ?? null;
  }

  /** 外部触发 retry 操作时调用，返回被操作的 toolCallId */
  handleRetry(runs: AgentRunState[]): string | null {
    if (runs.length === 0) return null;
    const run = runs[this.selectedIndex];
    if (run && (run.status === 'failed' || run.status === 'aborted') && this.config.onRetry) {
      this.config.onRetry(run.toolCallId);
    }
    return run?.toolCallId ?? null;
  }

  // ==================== 渲染 ====================

  /**
   * 渲染 agent 列表行。
   * @param runs 所有运行记录
   * @param innerWidth 内部可用宽度（不含边框）
   * @param isFocused 列表是否处于焦点状态
   * @param themeFg 主题着色函数
   * @returns 行数组（不含边框包裹，由调用方包裹）
   */
  render(
    runs: AgentRunState[],
    innerWidth: number,
    isFocused: boolean,
    themeFg: ThemeFg,
  ): string[] {
    const lines: string[] = [];

    if (runs.length === 0) {
      lines.push(themeFg('dim', '  暂无子 agent 运行记录'));
      lines.push(themeFg('dim', '  调用 spawn_agent 后自动出现'));
      return lines;
    }

    // 表头
    const headerText = '# Agent'.padEnd(innerWidth);
    lines.push(themeFg('muted', headerText));

    const visible = runs.slice(this.scrollOffset, this.scrollOffset + MAX_VISIBLE_AGENTS);
    for (let i = 0; i < visible.length; i++) {
      const globalIndex = this.scrollOffset + i;
      const run = visible[i];
      const isSelected = globalIndex === this.selectedIndex && isFocused;

      const icon = statusIcon(run.status, themeFg);
      const agentName = trunc(run.agent, 20);
      const statusText = run.status === 'running' ? '运行中' :
                         run.status === 'completed' ? '完成' :
                         run.status === 'failed' ? '失败' : '终止';
      const turnsStr = `${run.turns}轮`;
      const costStr = fmtCost(run.cost);
      const modelStr = run.model ? trunc(run.model, 12) : '';
      const durStr = run.durationMs ? fmtDuration(run.durationMs) : run.status === 'running' ? '...' : '';

      const prefix = isSelected ? themeFg('accent', '▸') : ' ';

      const parts = [
        prefix,
        icon,
        ' ',
        themeFg(isSelected ? 'accent' : 'text', agentName.padEnd(20)),
        ' ',
        themeFg(
          run.status === 'completed' ? 'success' :
          run.status === 'failed' ? 'error' :
          run.status === 'running' ? 'warning' : 'muted',
          statusText.padEnd(6)
        ),
        ' ',
        themeFg('dim', turnsStr.padEnd(5)),
        ' ',
        themeFg('dim', costStr.padEnd(8)),
        ' ',
        themeFg('dim', modelStr.padEnd(12)),
        ' ',
        themeFg('muted', durStr.padEnd(8)),
      ];

      let line = parts.join('');
      line = truncateToWidth(line, innerWidth);

      lines.push(' ' + line);
    }

    return lines;
  }

  // ==================== 内部 ====================

  private ensureVisible(): void {
    if (this.selectedIndex < this.scrollOffset) {
      this.scrollOffset = this.selectedIndex;
    } else if (this.selectedIndex >= this.scrollOffset + MAX_VISIBLE_AGENTS) {
      this.scrollOffset = this.selectedIndex - MAX_VISIBLE_AGENTS + 1;
    }
  }
}
