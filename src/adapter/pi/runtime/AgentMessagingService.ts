/**
 * @intent
 * IAgentMessagingService 的 pi 实现。组合 RpcProcessPool 的进程通道：
 * send 发 prompt、await 注册等待者、reply 写回 extension_ui_response、close 发 new_session。
 * 薄壳——只做参数透传与默认值，不含业务规则（agent 校验在 AgentRequestUseCase，进程管理在 pool）。
 *
 * 边界：无 RPC 池时直接报错（通信模式不降级到一次性 spawn）；进程不存在时由 pool 按 agent 定义创建。
 *
 * 验收条件：
 * - 四方法均委托 pool 且结果透传（await 返回 AgentAwaitResult 原样）
 * - close 委托 resetSession（new_session 语义）
 */

import type { IAgentMessagingService, AgentAwaitResult } from '../../../application/services/IAgentMessagingService';
import { RpcProcessPool } from './RpcProcessPool';

export class AgentMessagingService implements IAgentMessagingService {
  constructor(private pool: RpcProcessPool) {}

  async send(
    agent: string,
    message: string,
    options?: { skipExts?: string[]; model?: string; onEvent?: (event: Record<string, unknown>) => void },
  ): Promise<void> {
    await this.pool.sendMessage(agent, message, options);
  }

  await(agent: string, timeoutMs?: number): Promise<AgentAwaitResult> {
    return this.pool.awaitMessage(agent, timeoutMs);
  }

  reply(agent: string, answer: string): Promise<void> {
    return this.pool.replyMessage(agent, answer);
  }

  close(agent: string): Promise<void> {
    return this.pool.resetSession(agent);
  }
}
