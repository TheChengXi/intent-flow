/**
 * @intent TUI 仪表盘共享工具函数。纯函数，无状态，供各 UI 组件复用。
 */

import { truncateToWidth, visibleWidth } from '@earendil-works/pi-tui';
import type { ThemeColor } from '@earendil-works/pi-coding-agent';

/** theme.fg 函数签名 — (color: ThemeColor, text: string) => string */
export type ThemeFg = (color: ThemeColor, text: string) => string;

// ==================== 格式化 ====================

/** 格式化耗时 */
export function fmtDuration(ms: number | undefined): string {
  if (ms === undefined || ms < 0) return '...';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m${s}s`;
}

/** 格式化时间戳为 HH:MM:SS */
export function fmtTime(ts: number): string {
  if (ts <= 0) return '';
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
}

/** 格式化金额 */
export function fmtCost(cost: number): string {
  if (cost <= 0) return '-';
  if (cost < 0.01) return '<$0.01';
  return `$${cost.toFixed(4)}`;
}

// ==================== 图标 ====================

/** 获取状态图标 */
export function statusIcon(status: string, themeFg: ThemeFg): string {
  switch (status) {
    case 'running': return themeFg('warning', '▶');
    case 'completed': return themeFg('success', '✓');
    case 'failed': return themeFg('error', '✗');
    case 'aborted': return themeFg('muted', '⊘');
    default: return themeFg('dim', '○');
  }
}

/** 获取日志级别图标 */
export function logIcon(level: string, themeFg: ThemeFg): string {
  switch (level) {
    case 'thinking': return themeFg('mdQuote', '🤔');
    case 'tool_call': return themeFg('accent', '🔧');
    case 'tool_result': return themeFg('mdCode', '📦');
    case 'output': return themeFg('toolOutput', '💬');
    case 'error': return themeFg('error', '❌');
    case 'done': return themeFg('success', '✅');
    case 'question': return themeFg('error', '❓');
    case 'reply': return themeFg('success', '↩');
    case 'info': return themeFg('dim', 'ℹ');
    default: return ' ';
  }
}

// ==================== 截断 ====================

/** 截断字符串（ANSI 安全），保留指定可见宽度 */
export function trunc(text: string, max: number): string {
  return truncateToWidth(text, max);
}

/** 计算字符串的可见宽度（去除 ANSI 转义序列） */
export function visWidth(text: string): number {
  return visibleWidth(text);
}
