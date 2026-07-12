/**
 * @intent 子 agent TUI 仪表盘。通过 ctx.ui.custom({ overlay: true }) 渲染，
 * 包含：agent 列表（可键盘导航）、选中 agent 的实时日志、底部操作栏。
 * ↑↓ 导航，Enter 查看日志，k 终止，r 重试，q/Esc 关闭。
 */

import {
  matchesKey,
  Key,
  truncateToWidth,
  visibleWidth,
  wrapTextWithAnsi,
} from '@earendil-works/pi-tui';
import type { Theme } from '@earendil-works/pi-coding-agent';
import { AgentRunTracker, type AgentRunState, type LogEntry } from './AgentRunTracker';

// ==================== 常量 ====================

const MAX_VISIBLE_AGENTS = 12;
const MAX_VISIBLE_LOGS = 15;
const MIN_LOG_LINES = 5;
const MIN_TERM_WIDTH = 60;

// ==================== 工具函数 ====================

/** 格式化耗时 */
function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m${s}s`;
}

/** 格式化时间戳为 HH:MM:SS */
function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

/** 格式化金额 */
function fmtCost(cost: number): string {
  if (cost <= 0) return '-';
  if (cost < 0.01) return '<$0.01';
  return `$${cost.toFixed(4)}`;
}

/** 获取状态图标 */
function statusIcon(status: string, themeFg: (c: string, t: string) => string): string {
  switch (status) {
    case 'running': return themeFg('warning', '▶');
    case 'completed': return themeFg('success', '✓');
    case 'failed': return themeFg('error', '✗');
    case 'aborted': return themeFg('muted', '⊘');
    default: return themeFg('dim', '○');
  }
}

/** 获取日志级别图标 */
function logIcon(level: string, themeFg: (c: string, t: string) => string): string {
  switch (level) {
    case 'thinking': return themeFg('mdQuote', '🤔');
    case 'tool_call': return themeFg('accent', '🔧');
    case 'tool_result': return themeFg('mdCode', '📦');
    case 'output': return themeFg('toolOutput', '💬');
    case 'error': return themeFg('error', '❌');
    case 'done': return themeFg('success', '✅');
    case 'info': return themeFg('dim', 'ℹ');
    default: return ' ';
  }
}

/** 截断字符串（ANSI 安全） */
function trunc(text: string, max: number): string {
  return truncateToWidth(text, max);
}

// ==================== 仪表盘组件 ====================

export interface SubAgentViewConfig {
  tracker: AgentRunTracker;
  /** 关闭回调 */
  onClose: () => void;
  /** 终止运行的回调（传入 toolCallId） */
  onKill?: (toolCallId: string) => void;
  /** 重试运行的回调（传入 toolCallId） */
  onRetry?: (toolCallId: string) => void;
}

interface AgentListMetrics {
  /** 每行格式化的 agent 信息行 */
  lines: string[];
  /** 选中的索引 */
  selectedIndex: number;
  /** 滚动偏移 */
  scrollOffset: number;
}

export class SubAgentView {
  private tracker: AgentRunTracker;
  private onClose: () => void;
  private onKill?: (toolCallId: string) => void;
  private onRetry?: (toolCallId: string) => void;

  /** 当前选中的 agent 在列表中的索引 */
  private selectedIndex = 0;
  /** agent 列表滚动偏移 */
  private scrollOffset = 0;
  /** 焦点模式：'list' | 'logs' */
  private focusMode: 'list' | 'logs' = 'list';
  /** 日志滚动偏移 */
  private logScrollOffset = 0;

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
  }

  /** 缓存 */
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(config: SubAgentViewConfig) {
    this.tracker = config.tracker;
    this.onClose = config.onClose;
    this.onKill = config.onKill;
    this.onRetry = config.onRetry;
  }

  handleInput(data: string): void {
    if (matchesKey(data, Key.escape) || matchesKey(data, 'q')) {
      this.onClose();
      return;
    }

    const runs = this.tracker.getAllRuns();
    if (runs.length === 0) return;

    if (matchesKey(data, Key.tab)) {
      // 切换焦点
      this.focusMode = this.focusMode === 'list' ? 'logs' : 'list';
      this.invalidate();
      return;
    }

    if (this.focusMode === 'list') {
      if (matchesKey(data, Key.up)) {
        this.selectedIndex = Math.max(0, this.selectedIndex - 1);
        this.ensureVisible(runs.length);
        this.invalidate();
      } else if (matchesKey(data, Key.down)) {
        this.selectedIndex = Math.min(runs.length - 1, this.selectedIndex + 1);
        this.ensureVisible(runs.length);
        this.invalidate();
      } else if (matchesKey(data, Key.enter)) {
        // Enter → 切换到日志视图
        this.focusMode = 'logs';
        this.logScrollOffset = 0;
        this.invalidate();
      } else if (matchesKey(data, 'k') || matchesKey(data, 'K')) {
        // k → 终止选中的运行中 agent
        const run = runs[this.selectedIndex];
        if (run && run.status === 'running' && this.onKill) {
          this.onKill(run.toolCallId);
        }
      } else if (matchesKey(data, 'r') || matchesKey(data, 'R')) {
        // r → 重试失败的 agent
        const run = runs[this.selectedIndex];
        if (run && (run.status === 'failed' || run.status === 'aborted') && this.onRetry) {
          this.onRetry(run.toolCallId);
        }
      }
    } else {
      // 日志视图焦点
      if (matchesKey(data, Key.up)) {
        this.logScrollOffset = Math.min(
          this.logScrollOffset + 1,
          this.getMaxLogScroll(runs[this.selectedIndex])
        );
        this.invalidate();
      } else if (matchesKey(data, Key.down)) {
        this.logScrollOffset = Math.max(0, this.logScrollOffset - 1);
        this.invalidate();
      } else if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape)) {
        // Enter/Esc → 切回列表视图
        this.focusMode = 'list';
        this.logScrollOffset = 0;
        this.invalidate();
      }
    }
  }

  private ensureVisible(total: number): void {
    if (this.selectedIndex < this.scrollOffset) {
      this.scrollOffset = this.selectedIndex;
    } else if (this.selectedIndex >= this.scrollOffset + MAX_VISIBLE_AGENTS) {
      this.scrollOffset = this.selectedIndex - MAX_VISIBLE_AGENTS + 1;
    }
  }

  private getMaxLogScroll(run: AgentRunState | undefined): number {
    if (!run) return 0;
    const logs = this.getDisplayLogs(run);
    return Math.max(0, logs.length - MAX_VISIBLE_LOGS);
  }

  private getDisplayLogs(run: AgentRunState): LogEntry[] {
    if (run.mode === 'chain' && run.steps && run.steps.length > 0) {
      // Chain 模式：展平所有步骤的日志
      const allLogs: LogEntry[] = [];
      for (const step of run.steps) {
        allLogs.push({
          timestamp: 0,
          level: 'info',
          text: `── Step ${step.index}: ${step.agent} (${step.status}) ──`,
        });
        allLogs.push(...step.logs);
      }
      return allLogs;
    }
    return run.logs;
  }

  /** 构建 agent 列表行 */
  private buildAgentLines(runs: AgentRunState[], width: number, themeFg: (c: string, t: string) => string): string[] {
    const lines: string[] = [];
    const visible = runs.slice(this.scrollOffset, this.scrollOffset + MAX_VISIBLE_AGENTS);

    // 表头
    const headerWidth = width - 2; // 去掉左右边框
    const header = themeFg('muted', '# Agent'.padEnd(headerWidth));
    lines.push(header);

    for (let i = 0; i < visible.length; i++) {
      const globalIndex = this.scrollOffset + i;
      const run = visible[i];
      const isSelected = globalIndex === this.selectedIndex && this.focusMode === 'list';

      // 格式: # agent status turns cost model duration
      const icon = statusIcon(run.status, themeFg);
      const agentName = trunc(run.agent, 20);
      const statusText = run.status === 'running' ? '运行中' :
                         run.status === 'completed' ? '完成' :
                         run.status === 'failed' ? '失败' : '终止';
      const turnsStr = `${run.turns}轮`;
      const costStr = fmtCost(run.cost);
      const modelStr = run.model ? trunc(run.model, 12) : '';
      const durStr = run.durationMs ? fmtDuration(run.durationMs) : run.status === 'running' ? '...' : '';

      // 序号
      const idx = `${globalIndex + 1}`.padStart(2, ' ');
      const prefix = isSelected ? themeFg('accent', '▸') : ' ';

      // 构建行
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

      // 截断到可用宽度
      line = truncateToWidth(line, width - 2);

      // 选中行加背景
      if (isSelected) {
        // 用 bgSelected 样式包裹整行
        const vw = visibleWidth(line);
        const padded = line + ' '.repeat(Math.max(0, width - 2 - vw));
        line = padded;
      }

      lines.push((isSelected ? '' : ' ') + line);
    }

    return lines;
  }

  /** 构建日志行 */
  private buildLogLines(run: AgentRunState | undefined, width: number, themeFg: (c: string, t: string) => string): string[] {
    if (!run) {
      return ['', themeFg('dim', '  没有选中的 agent')];
    }

    const logs = this.getDisplayLogs(run);
    if (logs.length === 0) {
      if (run.status === 'running') {
        return ['', themeFg('dim', '  等待子 agent 输出...')];
      }
      return ['', themeFg('dim', '  无日志')];
    }

    const visibleLogs = logs.slice(
      Math.max(0, logs.length - MAX_VISIBLE_LOGS - this.logScrollOffset),
      logs.length - this.logScrollOffset
    );

    if (visibleLogs.length === 0) {
      return ['', themeFg('dim', '  (已到顶部)')];
    }

    const lines: string[] = [''];
    for (const log of visibleLogs) {
      const time = log.timestamp > 0 ? themeFg('dim', fmtTime(log.timestamp)) : '';
      const icon = logIcon(log.level, themeFg);

      // 根据日志级别着色
      let coloredText: string;
      switch (log.level) {
        case 'error':
          coloredText = themeFg('error', log.text);
          break;
        case 'tool_call':
          coloredText = themeFg('accent', trunc(log.text, width - 12));
          break;
        case 'thinking':
          coloredText = themeFg('mdQuote', trunc(log.text, width - 12));
          break;
        case 'output':
          coloredText = themeFg('toolOutput', trunc(log.text, width - 12));
          break;
        case 'done':
          coloredText = themeFg('success', log.text);
          break;
        default:
          coloredText = trunc(log.text, width - 12);
      }

      const wrapped = wrapTextWithAnsi(`  ${time} ${icon} ${coloredText}`, width - 2);
      for (const wl of wrapped) {
        lines.push(wl);
      }
    }

    return lines;
  }

  render(width: number, themeFg: (c: string, t: string) => string, themeBold?: (t: string) => string): string[] {
    // 检查终端宽度
    if (width < MIN_TERM_WIDTH) {
      return [
        themeFg('error', `终端太窄 (${width} < ${MIN_TERM_WIDTH})，无法显示仪表盘`),
      ];
    }

    // ── 顶部：标题栏 ──
    const runs = this.tracker.getAllRuns();
    const summary = this.tracker.getSummary();
    const selectedRun = runs[this.selectedIndex];

    const innerW = width - 2; // ┌ ┐ 之间的宽度
    const title = themeBold ? themeBold('SubAgent Monitor') : 'SubAgent Monitor';
    const titlePad = Math.max(0, innerW - visibleWidth(title));
    const topBorder = themeFg('border', `┌ ${title}${'─'.repeat(titlePad > 0 ? titlePad - 1 : 0)}┐`);
    const sepBar = themeFg('border', `├${'─'.repeat(innerW)}┤`);
    const botBorder = themeFg('border', `└${'─'.repeat(innerW)}┘`);

    // 内容区宽度 = 总宽度 - 2（两边边框）
    const cw = width - 2;
    // 包装一行内容到边框内（自动补齐右空格）
    const borderLine = (content: string) => {
      const trimmed = truncateToWidth(content, cw);
      const pad = cw - visibleWidth(trimmed);
      return `│${trimmed}${' '.repeat(Math.max(0, pad))}│`;
    };

    const lines: string[] = [topBorder];

    // ── Agent 列表区域 ──
    if (runs.length === 0) {
      lines.push(borderLine(themeFg('dim', '  暂无子 agent 运行记录')));
      lines.push(borderLine(themeFg('dim', '  调用 spawn_agent 后自动出现')));
    } else {
      const agentLines = this.buildAgentLines(runs, width, themeFg);
      for (const al of agentLines) {
        lines.push(borderLine(al));
      }
    }

    // ── 日志区域 ──
    lines.push(sepBar);
    const logHeader = this.focusMode === 'logs'
      ? ` ${themeFg('accent', '▸')} ${themeFg('accent', selectedRun?.agent ?? '')} 日志 ${themeFg('dim', '[↑↓滚动 Enter返回]')}`
      : ` ${selectedRun?.agent ?? ''} 日志 ${themeFg('dim', '[Enter查看]')}`;
    lines.push(borderLine(logHeader));

    if (selectedRun) {
      const logLines = this.buildLogLines(selectedRun, width, themeFg);
      for (const ll of logLines) {
        lines.push(borderLine(ll || ''));
      }
      // 日志区垫几行保证最低高度
      for (let i = 0; i < MIN_LOG_LINES; i++) {
        lines.push(`│${' '.repeat(cw)}│`);
      }
    } else {
      lines.push(borderLine(themeFg('dim', '  暂无 agent 运行记录')));
      for (let i = 0; i < MIN_LOG_LINES; i++) lines.push(`│${' '.repeat(cw)}│`);
    }

    // ── 底部状态栏 ──
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
    const keybindings = themeFg('dim', 'q关闭  ↑↓  Enter日志');
    const statusBar = `${statusLine}${' '.repeat(Math.max(0, cw - visibleWidth(statusLine) - visibleWidth(keybindings)))}${keybindings}`;
    lines.push(borderLine(statusBar));
    lines.push(botBorder);

    return lines;
  }
}

// ==================== 创建仪表盘（工厂函数） ====================

/**
 * 在 overlay 中打开子 agent 监控视图。
 * 使用方式：
 * ```
 * const done = await openSubAgentView(ctx, tracker, { onKill, onRetry });
 * ```
 */
export async function openSubAgentView(
  ctx: any,
  tracker: AgentRunTracker,
  options?: {
    onKill?: (toolCallId: string) => void;
    onRetry?: (toolCallId: string) => void;
  },
): Promise<void> {
  await ctx.ui.custom(
    (tui: any, theme: Theme, _kb: any, done: (v?: any) => void) => {
      const themeFg = theme.fg.bind(theme);

      const view = new SubAgentView({
        tracker,
        onClose: () => done(undefined),
        onKill: options?.onKill,
        onRetry: options?.onRetry,
      });

      // 订阅 tracker 变更，自动刷新
      const unsub = tracker.subscribe(() => {
        tui.requestRender();
      });

      return {
        render: (w: number) => {
          const themeBold = theme.bold?.bind ? theme.bold.bind(theme) : undefined;
          return view.render(w, themeFg, themeBold);
        },
        handleInput: (data: string) => {
          view.handleInput(data);
          tui.requestRender();
        },
        invalidate: () => {
          view.invalidate();
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
