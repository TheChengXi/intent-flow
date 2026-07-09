/**
 * @intent 子进程运行器接口。Phase 1 定义 run() 运行单个 agent。
 * 预留 runParallel() 和 runChain() 给 Phase 2+。
 */

import type { AgentRunResult } from '../entities/AgentRunResult';

/** 子进程运行参数 */
export interface SubProcessRunParams {
  /** Agent 名称（仅用于结果标识） */
  agentName: string;
  /** 系统提示词（含 include/ 知识库） */
  systemPrompt: string;
  /** 任务描述 */
  task: string;
  /** 工具白名单 */
  tools?: string[];
  /** 模型覆盖 */
  model?: string;
  /** 超时毫秒 */
  timeoutMs: number;
  /** 工作目录 */
  cwd: string;
  /** 额外上下文（追加到 system prompt） */
  context?: string;
  /** 子进程中间事件回调（JSON-L 事件流，用于可视化） */
  onEvent?: (event: Record<string, unknown>) => void;
  /** 子 agent 中跳过拦截的扩展名列表（对应 PI_EXT_SKIP 环境变量） */
  skipExts?: string[];
}

export interface ISubProcessRunner {
  /**
   * 在隔离子进程中运行 agent，返回结构化结果。
   * 通过 spawn pi --mode json 启动子进程，
   * 解析 JSON Lines 输出，收集 usage 和最终 output。
   */
  run(params: SubProcessRunParams): Promise<AgentRunResult>;

  // ==================== Phase 2+ 预留方法 ====================

  /**
   * Phase 2+：并发运行多个 agent，限制最大并发数。
   */
  // runParallel(params: SubProcessParallelParams): Promise<AgentRunResult[]>;

  /**
   * 链式运行，上一步输出作为下一步 {previous} 占位符。
   * 需要 RPC 进程池支持，无池时抛错。
   */
  runChain(steps: SubProcessChainStep[]): Promise<SubProcessChainResult>;
}

// ==================== Chain 模式类型 ====================

/** Chain 模式中的一步 */
export interface SubProcessChainStep {
  /** Agent 名称（对应 SUB-SKILL.md 的 name） */
  agent: string;
  /** 任务描述，支持 {previous} 占位符 */
  task: string;
}

/** Chain 执行结果 */
export interface SubProcessChainResult {
  /** 每一步的结果 */
  results: AgentRunResult[];
  /** 第一个失败的步骤索引，全部成功则为 null */
  failedIndex: number | null;
}
