/**
 * @intent 子 agent TUI 仪表盘。组合 AgentListPanel + LogPanel + StatusBar 三个组件，
 * 负责布局拼装、键盘事件路由和原子写入。不管理子组件的内部状态。
 * ↑↓ 导航，Enter 查看日志，Tab 切换焦点，k 终止，r 重试，q/Esc 关闭。
 */

import { matchesKey, Key, truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import type { Theme } from '@earendil-works/pi-coding-agent';
import { AgentRunTracker } from './AgentRunTracker';
import { AgentListPanel } from './AgentListPanel';
import { LogPanel } from './LogPanel';
import { StatusBar } from './StatusBar';
import type { ThemeFg } from './tui-utils';

// ==================== 常量 ====================

const MIN_TERM_WIDTH = 60;

// ==================== 仪表盘组件 ====================

export interface SubAgentViewConfig {
  tracker: AgentRunTracker;
  onClose: () => void;
  onKill?: (toolCallId: string) => void;
  onRetry?: (toolCallId: string) => void;
  /** 用户主动关闭的回调（区别于自动关闭） */
  onUserDismiss?: () => void;
}

export class SubAgentView {
  private tracker: AgentRunTracker;
  private onClose: () => void;
  private onKill?: (toolCallId: string) => void;
  private onRetry?: (toolCallId: string) => void;

  private agentList: AgentListPanel;
  private logPanel: LogPanel;
  private statusBar: StatusBar;

  /** 焦点模式：'list' | 'logs' */
  private focusMode: 'list' | 'logs' = 'list';

  constructor(config: SubAgentViewConfig) {
    this.tracker = config.tracker;
    this.onClose = config.onClose;
    this.onKill = config.onKill;
    this.onRetry = config.onRetry;

    this.agentList = new AgentListPanel({
      onKill: config.onKill,
      onRetry: config.onRetry,
    });
    this.logPanel = new LogPanel();
    this.statusBar = new StatusBar();
  }

  // ==================== 键盘事件路由 ====================

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || matchesKey(data, 'q')) {
      this.onClose();
      return;
    }

    const runs = this.tracker.getAllRuns();
    if (runs.length === 0) return;

    if (matchesKey(data, Key.tab)) {
      this.focusMode = this.focusMode === 'list' ? 'logs' : 'list';
      return;
    }

    if (this.focusMode === 'list') {
      // k/r: 由 SubAgentView 处理（涉及 agentList 的回调）
      if (matchesKey(data, 'k') || data === 'K') {
        const run = runs[this.agentList.getSelectedIndex()];
        if (run && run.status === 'running' && this.onKill) {
          this.onKill(run.toolCallId);
        }
        return;
      }
      if (matchesKey(data, 'r') || data === 'R') {
        const run = runs[this.agentList.getSelectedIndex()];
        if (run && (run.status === 'failed' || run.status === 'aborted') && this.onRetry) {
          this.onRetry(run.toolCallId);
        }
        return;
      }

      const shouldSwitch = this.agentList.handleInput(data, runs.length);
      if (shouldSwitch) {
        this.focusMode = 'logs';
        this.logPanel.reset();
      }
    } else {
      // 日志视图焦点
      if (matchesKey(data, Key.up) || matchesKey(data, Key.down)) {
        const selectedRun = runs[this.agentList.getSelectedIndex()];
        if (selectedRun) {
          this.logPanel.handleInput(data, selectedRun.logs);
        }
        return;
      }
      if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape)) {
        this.focusMode = 'list';
        return;
      }
    }
  }

  // ==================== 渲染 ====================

  render(
    width: number,
    themeFg: ThemeFg,
    themeBold?: (t: string) => string,
  ): string[] {
    if (width < MIN_TERM_WIDTH) {
      return [
        themeFg('error', `终端太窄 (${width} < ${MIN_TERM_WIDTH})，无法显示仪表盘`),
      ];
    }

    const runs = this.tracker.getAllRuns();
    const summary = this.tracker.getSummary();
    const selectedRun = runs[this.agentList.getSelectedIndex()] ?? undefined;

    const innerW = width - 2; // 边框内宽度
    const border = (c: string) => themeFg('border', c);

    // ── 收集各区域的行（不包含边框、不分隔线） ──

    // 区域 1: Agent 列表
    const agentLines = this.agentList.render(
      runs,
      innerW,
      this.focusMode === 'list',
      themeFg,
    );

    // 区域 2: 日志区（固定行高）
    const logLines = this.logPanel.render(
      selectedRun,
      innerW,
      this.focusMode === 'logs',
      themeFg,
    );

    // 区域 3: 状态栏
    const statusText = this.statusBar.render(runs, summary, innerW, themeFg);

    // ── 拼装带边框的完整输出 ──

    const title = themeBold ? themeBold('SubAgent Monitor') : 'SubAgent Monitor';
    const titleWidth = visibleWidth(title);
    const topPad = Math.max(0, innerW - titleWidth);

    const result: string[] = [];

    // 顶部边框（含标题）
    result.push(border(`┌ ${title}${'─'.repeat(topPad > 0 ? topPad : 0)}┐`));

    // Agent 列表区
    for (const al of agentLines) {
      result.push(this.wrapLine(al, innerW, themeFg));
    }

    // 分隔线
    result.push(border(`├${'─'.repeat(innerW)}┤`));

    // 日志区
    for (const ll of logLines) {
      result.push(this.wrapLine(ll, innerW, themeFg));
    }

    // 分隔线
    result.push(border(`├${'─'.repeat(innerW)}┤`));

    // 状态栏
    result.push(this.wrapLine(statusText, innerW, themeFg));

    // 底部边框
    result.push(border(`└${'─'.repeat(innerW)}┘`));

    return result;
  }

  /** 用 │ │ 包裹一行内容，自动补齐右空格 */
  private wrapLine(
    content: string,
    innerWidth: number,
    themeFg: ThemeFg,
  ): string {
    const trimmed = truncateToWidth(content, innerWidth);
    const pad = innerWidth - visibleWidth(trimmed);
    return `│${trimmed}${' '.repeat(Math.max(0, pad))}│`;
  }
}

// ==================== 工厂函数 ====================

export async function openSubAgentView(
  ctx: any,
  tracker: AgentRunTracker,
  options?: {
    onKill?: (toolCallId: string) => void;
    onRetry?: (toolCallId: string) => void;
    /** 用户主动关闭仪表盘时回调（区别于自动关闭） */
    onUserDismiss?: () => void;
  },
): Promise<void> {
  await ctx.ui.custom(
    (tui: any, theme: Theme, _kb: any, done: (v?: any) => void) => {
      const themeFg = theme.fg.bind(theme);
      let closed = false;
      let unsub: (() => void) | null = null;

      // 安全关闭：防止重复调用 + 清理订阅
      const safeDone = (userDismiss: boolean) => {
        if (closed) return;
        closed = true;
        unsub?.();
        if (userDismiss) options?.onUserDismiss?.();
        done(undefined);
      };

      const config: SubAgentViewConfig = {
        tracker,
        onClose: () => safeDone(true),  // 用户主动关闭
        onKill: options?.onKill,
        onRetry: options?.onRetry,
        onUserDismiss: options?.onUserDismiss,
      };

      const view = new SubAgentView(config);

      unsub = tracker.subscribe(() => {
        if (closed) return;

        // 所有子 agent 已完成 → 自动关闭仪表盘
        if (tracker.getRunningRuns().length === 0 && tracker.getAllRuns().length > 0) {
          safeDone(false);  // 非用户主动，不触发 onUserDismiss
          return;
        }

        tui.requestRender();
      });

      return {
        render: (w: number) => {
          if (closed) return [];
          const themeBold = theme.bold?.bind ? theme.bold.bind(theme) : undefined;
          return view.render(w, themeFg, themeBold);
        },
        handleInput: (data: string) => {
          if (closed) return;
          view.handleInput(data);
          tui.requestRender();
        },
        invalidate: () => {
          // 子组件的 render 每次都会重建，无需额外 invalidate
        },
      };
    },
    {
      overlay: true,
      overlayOptions: {
        width: '90%',
        minWidth: MIN_TERM_WIDTH,
        maxHeight: '90%',
        anchor: 'center',
        margin: 1,
      },
    },
  );
}
