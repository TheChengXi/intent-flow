/**
 * @intent 日志面板组件。固定行高显示子 agent 的实时日志。
 * 组件自治：自己管理 logScrollOffset、日志去重指纹、缓存行。
 * 稳定性策略：固定行高（防边框破坏）+ 指纹去重（防重复输出）+ 行缓存（减少重建）。
 */

import { matchesKey, Key, wrapTextWithAnsi } from '@earendil-works/pi-tui';
import type { AgentRunState, LogEntry } from './AgentRunTracker';
import { fmtTime, logIcon, trunc, type ThemeFg } from './tui-utils';

// ==================== 常量 ====================

/** 日志区域固定行高（内容在此高度内滚动，不改变整体布局） */
const LOG_AREA_HEIGHT = 12;

// ==================== 组件 ====================

export class LogPanel {
  /** 日志滚动偏移 */
  private logScrollOffset = 0;

  /** 上次渲染的日志指纹 → 用于去重 */
  private lastFingerprint = '';
  /** 缓存的上次渲染行（指纹未变时复用） */
  private cachedLines: string[] | null = null;

  // ==================== 键盘事件 ====================

  handleInput(data: string, logs: LogEntry[]): boolean {
    const maxScroll = this.getMaxScroll(logs);

    if (matchesKey(data, Key.up)) {
      this.logScrollOffset = Math.min(maxScroll, this.logScrollOffset + 1);
      this.cachedLines = null; // 滚动后需要重建
    } else if (matchesKey(data, Key.down)) {
      this.logScrollOffset = Math.max(0, this.logScrollOffset - 1);
      this.cachedLines = null;
    } else if (matchesKey(data, Key.enter) || matchesKey(data, Key.escape)) {
      return true; // 返回列表视图
    }

    return false;
  }

  /** 重置滚动到底部（新日志追加时调用） */
  scrollToBottom(): void {
    this.logScrollOffset = 0;
  }

  /** 重置状态（切换 agent 时调用） */
  reset(): void {
    this.logScrollOffset = 0;
    this.lastFingerprint = '';
    this.cachedLines = null;
  }

  // ==================== 渲染 ====================

  /**
   * 渲染日志区域。
   * 始终返回 LOG_AREA_HEIGHT 行，固定行高保证整体布局稳定。
   *
   * @param run 当前选中的 agent 运行状态
   * @param innerWidth 内部可用宽度
   * @param isFocused 日志面板是否在焦点
   * @param themeFg 主题着色函数
   * @returns 固定 LOG_AREA_HEIGHT 行的数组
   */
  render(
    run: AgentRunState | undefined,
    innerWidth: number,
    _isFocused: boolean,
    themeFg: ThemeFg,
  ): string[] {
    // 1. 提取展示日志
    const displayLogs = this.getDisplayLogs(run);

    // 2. 指纹去重
    const fingerprint = this.computeFingerprint(displayLogs);
    if (fingerprint === this.lastFingerprint && this.cachedLines) {
      return this.cachedLines;
    }
    this.lastFingerprint = fingerprint;

    // 3. 构建日志行
    const logLines = this.buildLogLines(displayLogs, innerWidth, themeFg);

    // 4. 固定行高 — 截断或填充到 LOG_AREA_HEIGHT 行
    const result: string[] = new Array(LOG_AREA_HEIGHT);
    const visibleLogs = logLines.slice(
      Math.max(0, logLines.length - LOG_AREA_HEIGHT - this.logScrollOffset),
      Math.max(0, logLines.length - this.logScrollOffset)
    );

    // 填入可见日志行
    for (let i = 0; i < LOG_AREA_HEIGHT; i++) {
      if (i < visibleLogs.length) {
        result[i] = visibleLogs[i];
      } else {
        result[i] = ''; // 空行填充
      }
    }

    // 缓存并返回
    this.cachedLines = result;
    return result;
  }

  // ==================== 内部：日志提取 ====================

  /** 获取展示用的日志列表（chain 模式展平处理） */
  private getDisplayLogs(run: AgentRunState | undefined): LogEntry[] {
    if (!run) return [];

    if (run.mode === 'chain' && run.steps && run.steps.length > 0) {
      // Chain 模式：展平所有步骤的日志，步骤间插入分隔行
      const allLogs: LogEntry[] = [];
      for (const step of run.steps) {
        // 插入步骤标题（作为一条 info 日志）
        allLogs.push({
          timestamp: 0,
          level: 'info' as const,
          text: `── Step ${step.index}: ${step.agent} (${step.status}) ──`,
        });
        // 去重后的步骤日志
        const deduped = this.dedupeLogs(step.logs);
        allLogs.push(...deduped);
      }
      return allLogs;
    }

    return this.dedupeLogs(run.logs);
  }

  /** 日志去重：连续相同 text + level 的日志只保留一条 */
  private dedupeLogs(logs: LogEntry[]): LogEntry[] {
    if (logs.length <= 1) return logs;

    const result: LogEntry[] = [logs[0]];
    for (let i = 1; i < logs.length; i++) {
      const prev = result[result.length - 1];
      const curr = logs[i];
      // 如果和上一条的 text + level 完全相同，跳过
      if (prev.text === curr.text && prev.level === curr.level) {
        continue;
      }
      result.push(curr);
    }
    return result;
  }

  /** 计算日志指纹（用于去重判断） */
  private computeFingerprint(logs: LogEntry[]): string {
    if (logs.length === 0) return 'empty';
    const last = logs[logs.length - 1];
    return `${logs.length}:${last.level}:${last.text.slice(0, 60)}`;
  }

  /** 获取最大可滚动偏移 */
  private getMaxScroll(logs: LogEntry[]): number {
    // 简化处理：直接用日志条数估算，不做精确换行计算（滚动计算不需要精确）
    return Math.max(0, logs.length - LOG_AREA_HEIGHT);
  }

  // ==================== 内部：行构建 ====================

  /** 构建日志展示行 */
  private buildLogLines(
    logs: LogEntry[],
    innerWidth: number,
    themeFg: ThemeFg,
  ): string[] {
    if (logs.length === 0) return [];

    const lines: string[] = [];
    for (const log of logs) {
      const time = log.timestamp > 0 ? themeFg('dim', fmtTime(log.timestamp)) : '';
      const icon = logIcon(log.level, themeFg);

      // 根据日志级别着色
      let coloredText: string;
      switch (log.level) {
        case 'error':
          coloredText = themeFg('error', log.text);
          break;
        case 'tool_call':
          coloredText = themeFg('accent', trunc(log.text, innerWidth - 12));
          break;
        case 'thinking':
          coloredText = themeFg('mdQuote', trunc(log.text, innerWidth - 12));
          break;
        case 'output':
          coloredText = themeFg('toolOutput', trunc(log.text, innerWidth - 12));
          break;
        case 'done':
          coloredText = themeFg('success', log.text);
          break;
        default:
          coloredText = trunc(log.text, innerWidth - 12);
      }

      // 拼接并换行处理
      const rawLine = `  ${time} ${icon} ${coloredText}`;
      const wrapped = wrapTextWithAnsi(rawLine, innerWidth);
      for (const wl of wrapped) {
        lines.push(wl);
      }
    }

    return lines;
  }
}


