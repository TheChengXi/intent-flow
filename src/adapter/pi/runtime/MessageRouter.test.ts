/**
 * @intent
 * 测试 MessageRouterImpl 的公开接口（handleLine / dequeuePending）：
 * 事件行解析（extension_ui_request 提问入队与 askCount 计数、agent_end 结果归一化、其他事件忽略）、
 * 以及按 agent 隔离的提问 FIFO 队列消费。
 * 只测公开接口，不触碰内部状态；每个测试一个关注点。
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MessageRouterImpl } from './MessageRouter';
import type { AgentAwaitResult, AgentResultMessage } from '../../../application/services/IAgentMessagingService';

// ----------------------------------------------------------------
// Helper：构造 JSONL 事件行
// ----------------------------------------------------------------

/** extension_ui_request 事件行（method=input 时为提问） */
function questionEvent(id: string, title: string, method = 'input'): string {
  return JSON.stringify({ type: 'extension_ui_request', id, method, title });
}

/** agent_end 事件行 */
function endEvent(messages: unknown[]): string {
  return JSON.stringify({ type: 'agent_end', messages });
}

/** 断言 handleLine 返回 result 消息，并窄化类型便于后续断言 */
function expectResultMessage(result: AgentAwaitResult | null): AgentResultMessage {
  expect(result?.kind).toBe('result');
  if (!result || result.kind !== 'result') {
    throw new Error('期望 handleLine 返回 { kind: "result" } 消息');
  }
  return result;
}

// ----------------------------------------------------------------
// 测试套件
// ----------------------------------------------------------------
describe('MessageRouterImpl', () => {
  let router: MessageRouterImpl;

  beforeEach(() => {
    router = new MessageRouterImpl();
  });

  // ─────────────────────────────────────────────
  // handleLine：事件解析
  // ─────────────────────────────────────────────
  describe('handleLine 事件解析', () => {
    it('收到非 JSON 行返回 null', () => {
      expect(router.handleLine('a', 'not json')).toBeNull();
      expect(router.handleLine('a', '{ broken json')).toBeNull();
    });

    it('收到 extension_ui_request（method=input）返回 question：question=title、requestId=id、askCount=1', () => {
      const result = router.handleLine('a', questionEvent('req-1', '要问的问题'));

      expect(result).toEqual({
        kind: 'question',
        question: '要问的问题',
        requestId: 'req-1',
        askCount: 1,
      });
    });

    it('同一 agent 连续两次提问，第二次返回的 askCount 为 2', () => {
      const first = router.handleLine('a', questionEvent('req-1', '问题一'));
      const second = router.handleLine('a', questionEvent('req-2', '问题二'));

      expect(first).toEqual({
        kind: 'question',
        question: '问题一',
        requestId: 'req-1',
        askCount: 1,
      });
      expect(second).toEqual({
        kind: 'question',
        question: '问题二',
        requestId: 'req-2',
        askCount: 2,
      });
    });

    it('不同 agent 的提问计数相互独立，各自从 1 开始', () => {
      const resultA = router.handleLine('a', questionEvent('req-a', '问 a'));
      const resultB = router.handleLine('b', questionEvent('req-b', '问 b'));

      expect(resultA).toEqual({
        kind: 'question',
        question: '问 a',
        requestId: 'req-a',
        askCount: 1,
      });
      expect(resultB).toEqual({
        kind: 'question',
        question: '问 b',
        requestId: 'req-b',
        askCount: 1,
      });
    });

    it('收到 agent_end 返回 result：agent 名、exitCode=0、output 为 trim 后的文本、usage、model、messages 透传', () => {
      const messages = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: '  结果文本  ' }],
          usage: { input: 100, output: 50, cost: { total: 0.01 } },
          model: 'gpt-x',
          stopReason: 'end_turn',
        },
      ];
      const line = endEvent(messages);
      const parsed = JSON.parse(line) as { messages: unknown[] };

      const result = expectResultMessage(router.handleLine('agent-a', line));

      expect(result.result.agent).toBe('agent-a');
      expect(result.result.exitCode).toBe(0);
      expect(result.result.output).toBe('结果文本');
      expect(result.result.usage.turns).toBe(1);
      expect(result.result.usage.input).toBe(100);
      expect(result.result.usage.output).toBe(50);
      expect(result.result.usage.cost).toBeCloseTo(0.01, 5);
      expect(result.result.model).toBe('gpt-x');
      expect(result.result.messages).toEqual(parsed.messages);
    });

    it('agent_end 含 errorMessage 的 assistant 消息时 exitCode=1 且 error=errorMessage', () => {
      const messages = [
        {
          role: 'assistant',
          content: [{ type: 'text', text: '出错' }],
          usage: { input: 10, output: 5, cost: { total: 0.001 } },
          model: 'gpt-x',
          errorMessage: '模型调用失败',
        },
      ];

      const result = expectResultMessage(router.handleLine('agent-a', endEvent(messages)));

      expect(result.result.exitCode).toBe(1);
      expect(result.result.error).toBe('模型调用失败');
    });

    it('agent_end 多条 assistant 消息：usage 累加、turns=assistant 条数、model 取最后一条、output 拼接', () => {
      const messages = [
        { role: 'user', content: [{ type: 'text', text: '问题' }] },
        {
          role: 'assistant',
          content: [{ type: 'text', text: '第一条' }],
          usage: { input: 100, output: 50, cost: { total: 0.01 } },
          model: 'gpt-a',
        },
        {
          role: 'assistant',
          content: [{ type: 'text', text: '第二条' }],
          usage: { input: 200, output: 150, cost: { total: 0.02 } },
          model: 'gpt-b',
        },
      ];

      const result = expectResultMessage(router.handleLine('agent-a', endEvent(messages)));

      expect(result.result.usage.turns).toBe(2);
      expect(result.result.usage.input).toBe(300);
      expect(result.result.usage.output).toBe(200);
      expect(result.result.usage.cost).toBeCloseTo(0.03, 5);
      expect(result.result.model).toBe('gpt-b');
      expect(result.result.output.replace(/\s+/g, '')).toBe('第一条第二条');
    });

    it('收到其他事件（message_end、tool_result_end 等任意 JSON 对象）返回 null', () => {
      expect(router.handleLine('a', JSON.stringify({ type: 'message_end' }))).toBeNull();
      expect(router.handleLine('a', JSON.stringify({ type: 'tool_result_end' }))).toBeNull();
      expect(router.handleLine('a', JSON.stringify({ type: 'unknown_event', foo: 1 }))).toBeNull();
    });

    it('extension_ui_request 的 method 不是 input（confirm、notify）时返回 null', () => {
      expect(router.handleLine('a', questionEvent('req-1', '确认？', 'confirm'))).toBeNull();
      expect(router.handleLine('a', questionEvent('req-2', '通知', 'notify'))).toBeNull();
    });
  });

  // ─────────────────────────────────────────────
  // dequeuePending：提问队列消费
  // ─────────────────────────────────────────────
  describe('dequeuePending 提问队列', () => {
    it('无排队提问时返回 null', () => {
      expect(router.dequeuePending('a')).toBeNull();
      expect(router.dequeuePending('b')).toBeNull();
    });

    it('同 agent 两个提问按 FIFO 出队（askCount 分别为 2、1），取完返回 null', () => {
      router.handleLine('a', questionEvent('req-1', '问题一'));
      router.handleLine('a', questionEvent('req-2', '问题二'));

      expect(router.dequeuePending('a')).toEqual({
        kind: 'question',
        question: '问题一',
        requestId: 'req-1',
        askCount: 2,
      });
      expect(router.dequeuePending('a')).toEqual({
        kind: 'question',
        question: '问题二',
        requestId: 'req-2',
        askCount: 1,
      });
      expect(router.dequeuePending('a')).toBeNull();
    });

    it('agent_end 之后同 agent 的提问队列被清空，dequeuePending 返回 null', () => {
      router.handleLine('a', questionEvent('req-1', '问题'));
      router.handleLine('a', endEvent([]));

      expect(router.dequeuePending('a')).toBeNull();
    });

    it('awaitingReply：set 后可读取（通道分派依据），clear 后返回 null', () => {
      expect(router.getAwaitingReply('a')).toBeNull();

      router.setAwaitingReply('a', 'req-1');
      expect(router.getAwaitingReply('a')).toBe('req-1');

      router.clearAwaitingReply('a');
      expect(router.getAwaitingReply('a')).toBeNull();
    });

    it('awaitingReply：agent_end 时清除（任务结束，不再等待回复）', () => {
      router.setAwaitingReply('a', 'req-1');
      router.handleLine('a', endEvent([]));

      expect(router.getAwaitingReply('a')).toBeNull();
    });

    it('awaitingReply：不同 agent 隔离', () => {
      router.setAwaitingReply('a', 'req-a');

      expect(router.getAwaitingReply('a')).toBe('req-a');
      expect(router.getAwaitingReply('b')).toBeNull();
    });

    it('awaitingReply：resetChannel 后清除', () => {
      router.setAwaitingReply('a', 'req-a');
      router.resetChannel('a');

      expect(router.getAwaitingReply('a')).toBeNull();
    });

    it('getPendingRequestId 返回最早未回复提问的 id，无提问返回 null', () => {
      expect(router.getPendingRequestId('a')).toBeNull();

      router.handleLine('a', questionEvent('req-1', '问题一'));
      router.handleLine('a', questionEvent('req-2', '问题二'));

      expect(router.getPendingRequestId('a')).toBe('req-1');
    });

    it('removeQuestion 移除指定提问后，dequeuePending 不再返回它（防重复消费）', () => {
      router.handleLine('a', questionEvent('req-1', '问题一'));
      router.handleLine('a', questionEvent('req-2', '问题二'));

      // 模拟已投递/已回复：移除 req-1
      router.removeQuestion('a', 'req-1');

      expect(router.dequeuePending('a')).toEqual({
        kind: 'question',
        question: '问题二',
        requestId: 'req-2',
        askCount: 1,
      });
      expect(router.getPendingRequestId('a')).toBeNull();
    });
  });

  // ─────────────────────────────────────────────
  // 串行队列化：并发 send 排队 + 等待者配对（bug 修复场景）
  // ─────────────────────────────────────────────
  describe('串行任务队列（并发派发同一 agent）', () => {
    it('enqueue：无当前任务时返回 true（应立即启动），后续任务返回 false（排队）', () => {
      expect(router.enqueue('a', { id: 't1', message: '任务一', waiterBound: false })).toBe(true);
      expect(router.enqueue('a', { id: 't2', message: '任务二', waiterBound: false })).toBe(false);
      expect(router.enqueue('a', { id: 't3', message: '任务三', waiterBound: false })).toBe(false);
    });

    it('taskFinished：当前任务完成后依次交付下一个任务（FIFO），无排队返回 null', () => {
      router.enqueue('a', { id: 't1', message: '任务一', waiterBound: false });
      router.enqueue('a', { id: 't2', message: '任务二', waiterBound: false });

      expect(router.taskFinished('a')).toEqual({ id: 't2', message: '任务二', waiterBound: false });
      expect(router.taskFinished('a')).toBeNull();
    });

    it('taskFinished 对无任务/无 channel 的 agent 返回 null', () => {
      expect(router.taskFinished('ghost')).toBeNull();
    });

    it('bindWaiter：当前任务槽位空闲时绑定当前任务（提问续接场景）', () => {
      router.enqueue('a', { id: 't1', message: '任务一', waiterBound: false });

      expect(router.bindWaiter('a')).toEqual({ taskId: 't1' });
    });

    it('bindWaiter：当前任务已被占用时绑定队首未绑定任务（并发 await 排队）', () => {
      router.enqueue('a', { id: 't1', message: '任务一', waiterBound: false });
      router.enqueue('a', { id: 't2', message: '任务二', waiterBound: false });

      expect(router.bindWaiter('a')).toEqual({ taskId: 't1' }); // 当前任务优先
      expect(router.bindWaiter('a')).toEqual({ taskId: 't2' }); // 队首未绑定
      expect(router.bindWaiter('a')).toBeNull();               // 全部已绑定
    });

    it('releaseWaiter 释放槽位后可重新绑定同一任务（超时后重绑场景）', () => {
      router.enqueue('a', { id: 't1', message: '任务一', waiterBound: false });
      router.bindWaiter('a');
      router.releaseWaiter('a', 't1');

      expect(router.bindWaiter('a')).toEqual({ taskId: 't1' });
    });

    it('releaseWaiter 对排队任务生效', () => {
      router.enqueue('a', { id: 't1', message: '任务一', waiterBound: false });
      router.enqueue('a', { id: 't2', message: '任务二', waiterBound: false });
      router.bindWaiter('a'); // t1
      router.bindWaiter('a'); // t2
      router.releaseWaiter('a', 't2');

      expect(router.bindWaiter('a')).toEqual({ taskId: 't2' });
    });

    it('bindWaiter：无任何任务（无 channel）返回 null', () => {
      expect(router.bindWaiter('ghost')).toBeNull();
    });

    it('完整并发场景：两个任务排队、分别绑定等待者、各自提问与完成，消息不丢失', () => {
      // 并发派发两个任务（同一 agent）
      router.enqueue('a', { id: 't1', message: '任务一', waiterBound: false });
      router.enqueue('a', { id: 't2', message: '任务二', waiterBound: false });

      // 并发 await：t1 绑定当前任务，t2 绑定队首任务
      expect(router.bindWaiter('a')).toEqual({ taskId: 't1' });
      expect(router.bindWaiter('a')).toEqual({ taskId: 't2' });

      // t1 执行中提问 → 投递给 t1 的等待者
      const q = router.handleLine('a', questionEvent('req-1', 't1 的提问'));
      expect(q).toEqual({ kind: 'question', question: 't1 的提问', requestId: 'req-1', askCount: 1 });
      router.releaseWaiter('a', 't1');

      // 主 agent 回复后再次 await → 仍绑定当前任务 t1（提问续接）
      expect(router.bindWaiter('a')).toEqual({ taskId: 't1' });

      // t1 完成 → 投递 result，启动 t2
      const r1 = router.handleLine(
        'a',
        endEvent([
          { role: 'assistant', content: [{ type: 'text', text: '任务一结果' }], usage: { input: 1, output: 1, cost: { total: 0 } } },
          { role: 'assistant', content: [{ type: 'text', text: '' }], usage: { input: 1, output: 1, cost: { total: 0 } } },
        ]),
      );
      expect(r1?.kind).toBe('result');
      router.releaseWaiter('a', 't1');
      expect(router.taskFinished('a')).toEqual({ id: 't2', message: '任务二', waiterBound: true });

      // t2 完成 → 投递 result，无后续任务
      const r2 = router.handleLine('a', endEvent([{ role: 'assistant', content: [{ type: 'text', text: '任务二结果' }], usage: { input: 1, output: 1, cost: { total: 0 } } }]));
      expect(r2?.kind).toBe('result');
      expect(router.taskFinished('a')).toBeNull();
    });

    it('resetChannel 清空该 agent 全部状态（进程崩溃重建场景）', () => {
      router.enqueue('a', { id: 't1', message: '任务一', waiterBound: false });
      router.handleLine('a', questionEvent('req-1', '提问'));
      router.resetChannel('a');

      expect(router.bindWaiter('a')).toBeNull();
      expect(router.dequeuePending('a')).toBeNull();
      expect(router.taskFinished('a')).toBeNull();
    });

    it('不同 agent 的任务队列相互隔离', () => {
      router.enqueue('a', { id: 't1', message: '任务一', waiterBound: false });
      router.enqueue('b', { id: 't1', message: '任务一', waiterBound: false });

      // 各自独立 channel：都能绑定自己的 t1
      expect(router.bindWaiter('a')).toEqual({ taskId: 't1' });
      expect(router.bindWaiter('b')).toEqual({ taskId: 't1' });

      // a 的 taskFinished 不影响 b（b 的 t1 仍被绑定）
      router.taskFinished('a');
      expect(router.bindWaiter('b')).toBeNull();
    });
  });
});
