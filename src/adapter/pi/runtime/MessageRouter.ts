/**
 * @intent
 * 子进程会话调度状态机（纯逻辑，无 I/O）。职责：
 * 1) 任务串行队列化——同一 agent 的并发 send 排队，当前任务 agent_end 后经 taskFinished
 *    自动启动下一个（修复并发派发同一 agent 时 pending 覆盖导致消息丢失的 bug）
 * 2) 等待者配对——bindWaiter 优先绑定当前任务（提问续接），否则队首未绑定任务（并发 await 排队）
 * 3) 事件解析——extension_ui_request(method=input) 提问入队、agent_end 解析 AgentRunResult
 * 4) 提问队列——无人 await 时暂存，dequeuePending FIFO 消费
 * 与进程 I/O 分离（不 spawn、不写 stdin、不建 timer），可单测。
 *
 * 边界：超时由调用方（RpcProcessPool 的 awaitMessage timer）驱动，超时后调 releaseWaiter
 * 释放槽位；agent_end 清空该 agent 提问队列（任务结束，遗留提问作废）；
 * resetChannel 在进程重建/销毁时调用（队列作废，下个 send 开新上下文）；
 * extension_ui_request 仅 method=input 视为提问，其余忽略。
 *
 * 验收条件：
 * - enqueue 并发任务 FIFO 排队；taskFinished 依次交付下一个应启动的任务
 * - bindWaiter：当前任务槽位空闲优先，否则队首未绑定任务，无任务返回 null
 * - 提问续接：question 投递 + releaseWaiter 后再次 bindWaiter 仍绑定当前任务
 * - handleLine 解析规则与旧 parseAgentEnd 一致（usage 累加 / errorMessage→exitCode=1 / messages 透传）
 * - 不同 agent 的状态完全隔离
 */

import type { AgentAwaitResult, AgentQuestion, AgentRunResult } from '../../../application/services/IAgentMessagingService';

// ==================== 内部状态 ====================

/** 排队中的任务（一条待发送消息） */
export interface RouterTask {
  /** 任务唯一 id（调用方生成） */
  id: string;
  /** 消息内容（prompt 文本；taskFinished 返回后由调用方写入 stdin） */
  message: string;
  /** 是否已有等待者绑定（并发 await 排队时预绑定） */
  waiterBound: boolean;
}

/** 单 agent 的会话调度状态 */
interface Channel {
  /** 当前执行中的任务（无则 null） */
  current: RouterTask | null;
  /** 排队任务（FIFO） */
  queue: RouterTask[];
  /** 提问队列（无人 await 时暂存；agent_end 清空） */
  pendingQuestions: Array<{ question: string; requestId: string }>;
}

// ==================== 路由实现 ====================

export class MessageRouterImpl {
  private channels = new Map<string, Channel>();

  private ensure(agent: string): Channel {
    let ch = this.channels.get(agent);
    if (!ch) {
      ch = { current: null, queue: [], pendingQuestions: [] };
      this.channels.set(agent, ch);
    }
    return ch;
  }

  /**
   * 入队任务。返回 true 表示应立即启动（当前无任务），false 表示已排队。
   */
  enqueue(agent: string, task: RouterTask): boolean {
    const ch = this.ensure(agent);
    if (!ch.current) {
      ch.current = task;
      return true;
    }
    ch.queue.push(task);
    return false;
  }

  /**
   * 绑定等待者。规则：当前任务槽位空闲优先（提问续接），
   * 否则队首未绑定任务（并发 await 排队）。无任务可绑定时返回 null。
   */
  bindWaiter(agent: string): { taskId: string } | null {
    const ch = this.channels.get(agent);
    if (!ch) return null;
    if (ch.current && !ch.current.waiterBound) {
      ch.current.waiterBound = true;
      return { taskId: ch.current.id };
    }
    for (const t of ch.queue) {
      if (!t.waiterBound) {
        t.waiterBound = true;
        return { taskId: t.id };
      }
    }
    return null;
  }

  /**
   * 释放等待者槽位（等待者 resolve 后或超时后调用），使任务可被重新绑定。
   */
  releaseWaiter(agent: string, taskId: string): void {
    const ch = this.channels.get(agent);
    if (!ch) return;
    if (ch.current?.id === taskId) {
      ch.current.waiterBound = false;
      return;
    }
    const t = ch.queue.find((x) => x.id === taskId);
    if (t) t.waiterBound = false;
  }

  /**
   * 消费排队中的提问（await 开始时优先取，FIFO；无则 null）。
   */
  dequeuePending(agent: string): AgentQuestion | null {
    const ch = this.channels.get(agent);
    if (!ch || ch.pendingQuestions.length === 0) return null;
    const first = ch.pendingQuestions.shift()!;
    return { kind: 'question', ...first, askCount: ch.pendingQuestions.length + 1 };
  }

  /**
   * 取最早未回复提问的 requestId（reply 写回用；无则 null）。
   */
  getPendingRequestId(agent: string): string | null {
    const ch = this.channels.get(agent);
    if (!ch || ch.pendingQuestions.length === 0) return null;
    return ch.pendingQuestions[0].requestId;
  }

  /**
   * 移除已投递/已回复的提问（防重复消费）。
   */
  removeQuestion(agent: string, requestId: string): void {
    const ch = this.channels.get(agent);
    if (!ch) return;
    ch.pendingQuestions = ch.pendingQuestions.filter((q) => q.requestId !== requestId);
  }

  /**
   * 当前任务完成（agent_end 已投递 result）后调用：
   * 返回下一个应启动的任务（出队），无则 null。
   */
  taskFinished(agent: string): RouterTask | null {
    const ch = this.channels.get(agent);
    if (!ch || !ch.current) return null;
    ch.current = null;
    if (ch.queue.length > 0) {
      ch.current = ch.queue.shift()!;
      return ch.current;
    }
    return null;
  }

  /**
   * 清空该 agent 的全部状态（进程崩溃/销毁时调用，下个 send 开新上下文）。
   */
  resetChannel(agent: string): void {
    this.channels.delete(agent);
  }

  /**
   * 处理一行 stdout 事件；返回应投递给当前任务等待者的消息（无则 null）。
   * extension_ui_request(input) → 提问入队并返回（投递由调用方按当前任务执行）；
   * agent_end → 解析结果、清空提问队列、返回 result。
   */
  handleLine(agent: string, line: string): AgentAwaitResult | null {
    let event: any;
    try {
      event = JSON.parse(line);
    } catch {
      return null; // 非 JSON 行忽略
    }

    // ── extension_ui_request（method=input）：子 agent 提问 ──
    if (event.type === 'extension_ui_request' && event.method === 'input') {
      const ch = this.ensure(agent);
      ch.pendingQuestions.push({
        question: (event.title ?? event.placeholder ?? '') as string,
        requestId: event.id as string,
      });
      return {
        kind: 'question',
        question: ch.pendingQuestions[ch.pendingQuestions.length - 1].question,
        requestId: ch.pendingQuestions[ch.pendingQuestions.length - 1].requestId,
        askCount: ch.pendingQuestions.length,
      };
    }

    // ── agent_end：任务完成，解析结果并清空提问队列 ──
    if (event.type === 'agent_end') {
      const ch = this.channels.get(agent);
      if (ch) ch.pendingQuestions = [];
      return { kind: 'result', result: this.parseAgentEnd(event, agent) };
    }

    return null;
  }

  // ==================== 结果解析 ====================

  /** 从 agent_end 事件中提取结构化结果（与旧 RpcProcessPool.parseAgentEnd 行为一致） */
  private parseAgentEnd(event: any, agent: string): AgentRunResult {
    const messages: unknown[] = event.messages ?? [];
    const usage = { input: 0, output: 0, cost: 0, turns: 0 };
    let output = '';
    let resolvedModel: string | undefined;
    let stopReason: string | undefined;
    let errorMessage: string | undefined;

    for (const msg of messages as any[]) {
      if (msg.role !== 'assistant') continue;

      usage.turns++;

      if (msg.usage) {
        usage.input += msg.usage.input ?? 0;
        usage.output += msg.usage.output ?? 0;
        usage.cost += msg.usage.cost?.total ?? 0;
      }

      if (msg.model) resolvedModel = msg.model;
      if (msg.stopReason) stopReason = msg.stopReason;
      if (msg.errorMessage) errorMessage = msg.errorMessage;

      if (msg.content && Array.isArray(msg.content)) {
        for (const part of msg.content) {
          if (part.type === 'text') {
            output += part.text + '\n';
          }
        }
      }
    }

    return {
      agent,
      exitCode: errorMessage ? 1 : 0,
      output: output.trim().slice(0, 50 * 1024),
      error: errorMessage,
      usage,
      model: resolvedModel,
      durationMs: 0, // 由调用方填充
      messages,
      stopReason,
    };
  }
}
