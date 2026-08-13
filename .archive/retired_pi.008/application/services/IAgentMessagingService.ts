/**
 * @intent
 * agent 消息交换接口（application 端口）。定义与另一个 agent 上下文（pi RPC 子进程）
 * 通信的两个动作：send（发消息，自动分派通道——等待回复时走 response 通道，否则新消息
 * prompt 通道，非阻塞）+ await（阻塞等待下一条消息）。等待是动作的阻塞语义，不是独立工具。
 * AgentRunResult/AgentUsage 实体类型经此透出（承接 ISubProcessRunner 职责）。
 *
 * 边界：接口不含 agent 查找与进程管理；await 返回值区分 question/result/timeout/error 四类；
 * 不提供 close——不发消息即会话挂起为静态文本，进程生命周期由进程池管理。
 *
 * 验收条件：
 * - send/await 签名与设计文档一致（send 自动分派 response/prompt 通道）
 * - 实体类型 re-export 可被 adapter 直接引用且不出现 data/ 路径
 */

import type { AgentRunResult } from '../../data/entities/AgentRunResult';

// ==================== 实体类型透出 ====================
// adapter 层 runtime 组件经此引用实体类型，避免直接跨层 import data。

export type { AgentRunResult } from '../../data/entities/AgentRunResult';
export type { AgentUsage } from '../../data/entities/AgentUsage';

// ==================== 消息类型 ====================

/** 子 agent 提问（等待主 agent 回答） */
export interface AgentQuestion {
  kind: 'question';
  /** 提问文本 */
  question: string;
  /** extension_ui_request 的 id，reply 时回填 */
  requestId: string;
  /** 本任务内累计提问次数（供主 agent 参考） */
  askCount: number;
}

/** 子 agent 本轮完成 */
export interface AgentResultMessage {
  kind: 'result';
  result: AgentRunResult;
}

/** 等待超时 */
export interface AgentTimeoutMessage {
  kind: 'timeout';
}

/** 通道错误（进程崩溃等） */
export interface AgentErrorMessage {
  kind: 'error';
  message: string;
}

export type AgentAwaitResult =
  | AgentQuestion
  | AgentResultMessage
  | AgentTimeoutMessage
  | AgentErrorMessage;

// ==================== 服务接口 ====================

export interface IAgentMessagingService {
  /**
   * 发送消息到指定 agent 会话（非阻塞），自动分派通道：
   * - 该 agent 正在等待回复 → 消息作为回答走 extension_ui_response 通道（解除 ask_parent 阻塞）
   * - 否则 → 新消息走 prompt 通道（进程不存在时按 agent 定义创建；忙碌时 FIFO 入队不丢失）
   * @param options.skipExts 进程级白名单，仅首次 spawn 生效
   * @param options.model 模型覆盖，仅首次 spawn 生效
   * @param options.onEvent 子进程中间事件回调（可视化）
   */
  send(
    agent: string,
    message: string,
    options?: { skipExts?: string[]; model?: string; onEvent?: (event: Record<string, unknown>) => void },
  ): Promise<void>;

  /**
   * 阻塞等待下一条消息（question/result/timeout/error）。
   * @param timeoutMs 默认 600000（10 分钟）
   */
  await(agent: string, timeoutMs?: number): Promise<AgentAwaitResult>;
}
