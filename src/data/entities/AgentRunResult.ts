/**
 * @intent pi agent 运行结果实体。封装子进程退出码、输出文本、错误信息、
 * 运行统计（AgentUsage）、实际模型、耗时。output 截断到 50KB。
 * Phase 1 完整实现，预留 messages/stopReason/errorMessage 给 Phase 2+。
 */

import type { AgentUsage } from './AgentUsage';

export interface AgentRunResult {
  /** Agent 名称 */
  agent: string;
  /** 子进程退出码 */
  exitCode: number;
  /** 子进程输出文本（截断到 50KB） */
  output: string;
  /** 错误信息 */
  error?: string;
  /** 运行统计 */
  usage: AgentUsage;
  /** 实际使用的模型 */
  model?: string;
  /** 运行耗时（毫秒） */
  durationMs: number;

  // ==================== Phase 2+ 预留字段 ====================

  /** Phase 2+：完整的 JSON Lines 消息列表（用于 TUI 展开视图） */
  messages?: unknown[];
  /** Phase 2+：LLM stop reason */
  stopReason?: string;
  /** Phase 2+：LLM 错误消息 */
  errorMessage?: string;
}
