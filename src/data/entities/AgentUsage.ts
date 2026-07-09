/**
 * @intent pi agent 运行统计值对象。嵌入在 AgentRunResult 中，
 * 记录 input/output token 数、花费（美元）、交互轮数。Phase 1 完整实现。
 */

export interface AgentUsage {
  /** 输入 token 数 */
  input: number;
  /** 输出 token 数 */
  output: number;
  /** 花费（美元） */
  cost: number;
  /** 交互轮数 */
  turns: number;
  /** Phase 2+：缓存读取 token */
  cacheRead?: number;
  /** Phase 2+：缓存写入 token */
  cacheWrite?: number;
  /** Phase 2+：上下文 token */
  contextTokens?: number;
}
