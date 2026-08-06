/**
 * @intent
 * agent 通信工具集注册（4 工具：agent_request / agent_await / agent_reply / agent_close）
 * + TUI 渲染 + tracker 推送。渲染辅助函数自 SpawnAgentTool 迁移。
 * 工具收敛说明：agent_send 已移除——串行模型下其语义被 agent_request（send+await）完全覆盖，
 * 减少工具数降低模型误选率（业界“fewer tools outperform more tools”）；send 仍作为内部通道存在
 * （IAgentMessagingService.send，仅供 AgentRequestUseCase 使用，不注册为工具）。
 * 会话管理：Map<agent, toolCallId> 维持“一行一 agent”的多轮轨迹——续会话复用条目追加日志，
 * close 后新会话开新条目。
 *
 * 边界：await/request 返回 question 时渲染提问卡片并提示用 agent_reply 回答后继续 await；
 * timeout/error 有明确呈现；tracker 推送失败不阻塞主流程；无 tracker 时静默降级。
 *
 * 验收条件：
 * - 4 工具注册名与参数 schema 与设计文档一致（无 agent_send）
 * - question → reply → await 循环中 tracker 日志按序追加（question/reply 级别）
 * - agent_request 行为与旧 spawn_agent 等价（派发任务拿结果）
 */

import type { ExtensionAPI, AgentToolResult, Theme } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { Container, Markdown, Spacer, Text } from '@earendil-works/pi-tui';
import { getMarkdownTheme } from '@earendil-works/pi-coding-agent';
import type {
  AgentAwaitResult,
  AgentRunResult,
  IAgentMessagingService,
} from '../../../application/services/IAgentMessagingService';
import type { AgentRequestUseCase } from '../../../application/useCases/AgentRequestUseCase';
import type { AgentRunTracker } from '../tui/AgentRunTracker';
import type { ThemeFg } from '../tui/tui-utils';

// ==================== 渲染辅助函数（自 SpawnAgentTool 迁移） ====================

function formatUsage(result: AgentRunResult): string {
  const parts: string[] = [];
  if (result.usage.turns) parts.push(`${result.usage.turns} 轮`);
  if (result.usage.input) parts.push(`↑${result.usage.input}`);
  if (result.usage.output) parts.push(`↓${result.usage.output}`);
  if (result.usage.cost > 0) parts.push(`$${result.usage.cost.toFixed(4)}`);
  if (result.model) parts.push(result.model);
  return parts.length > 0 ? parts.join(' ') : '';
}

function formatToolCall(
  toolName: string,
  args: Record<string, unknown>,
  fg: ThemeFg,
): string {
  if (toolName === 'bash') {
    const cmd = (args.command as string) || '';
    return fg('muted', '$ ') + fg('toolOutput', cmd.length > 60 ? cmd.slice(0, 60) + '...' : cmd);
  }
  if (toolName === 'read') {
    const p = (args.path || args.file_path || '') as string;
    return fg('muted', 'read ') + fg('accent', p);
  }
  const argsStr = JSON.stringify(args);
  return fg('accent', toolName) + fg('dim', ' ' + (argsStr.length > 50 ? argsStr.slice(0, 50) + '...' : argsStr));
}

interface DisplayItem {
  type: 'text' | 'toolCall';
  text?: string;
  name?: string;
  args?: Record<string, unknown>;
}

function getDisplayItems(messages: unknown[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  for (const msg of messages as any[]) {
    if (msg?.role !== 'assistant') continue;
    for (const part of msg.content || []) {
      if (part.type === 'text') items.push({ type: 'text', text: part.text });
      else if (part.type === 'toolCall') items.push({ type: 'toolCall', name: part.name, args: part.arguments });
    }
  }
  return items;
}

/** 从消息中提取文本内容 */
function extractContentText(msg: any): string {
  if (!msg?.content) return '';
  if (typeof msg.content === 'string') return msg.content.trim();
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((p: any) => p.type === 'text')
      .map((p: any) => p.text || '')
      .join(' ')
      .trim();
  }
  return '';
}

function getFinalOutput(messages: unknown[]): string {
  for (let i = (messages as any[]).length - 1; i >= 0; i--) {
    const msg = (messages as any[])[i];
    if (msg?.role === 'assistant') {
      for (const part of msg.content || []) {
        if (part.type === 'text') return part.text;
      }
    }
  }
  return '';
}

// ==================== 工具集 ====================

export class AgentCommTools {
  /** agent → 当前会话 tracker 条目 toolCallId（维持多轮轨迹） */
  private sessionIds = new Map<string, string>();

  constructor(
    private messaging: IAgentMessagingService,
    private requestUseCase: AgentRequestUseCase,
    private tracker?: AgentRunTracker,
  ) {}

  register(pi: ExtensionAPI): void {
    this.registerRequest(pi);
    this.registerAwait(pi);
    this.registerReply(pi);
    this.registerClose(pi);
  }

  // ==================== 会话管理 ====================

  /** 构造子进程事件转发（tracker 实时日志，含防刷） */
  private makeEventForwarder(sid: string): (event: Record<string, unknown>) => void {
    let lastUpdateText = '';
    return (event) => {
      try {
        const type = event.type;
        if (type === 'tool_execution_start') {
          const ev = event as any;
          const argsStr = ev.args ? JSON.stringify(ev.args).slice(0, 80) : '';
          this.tracker?.addLog(sid, {
            level: 'tool_call',
            text: `${ev.toolName} ${argsStr}`,
            toolName: ev.toolName,
            toolArgs: argsStr,
          });
        } else if (type === 'message_update') {
          const ev = event as any;
          if (ev.message?.role === 'assistant') {
            const text = extractContentText(ev.message);
            // 防刷：文本累积超过 30 字才推一次
            if (text && text.length > lastUpdateText.length + 30) {
              lastUpdateText = text;
              this.tracker?.addLog(sid, { level: 'output', text: text.slice(0, 200) });
            }
          }
        } else if (type === 'message_end') {
          const ev = event as any;
          if (ev.message?.role === 'assistant') {
            const text = extractContentText(ev.message);
            if (text) {
              this.tracker?.addLog(sid, { level: 'output', text: text.slice(0, 200) });
            }
            this.tracker?.updateRun(sid, {
              turns: (this.tracker.getRun(sid)?.turns ?? 0) + 1,
              model: ev.message.model,
            });
          }
        } else if (type === 'tool_execution_end') {
          const ev = event as any;
          const status = ev.isError ? 'error' : 'tool_result';
          let preview = `${ev.toolName} 完成`;
          if (ev.result?.content) {
            const textContent = extractContentText({ content: ev.result.content });
            if (textContent) {
              preview = `${ev.toolName} → ${textContent.slice(0, 80)}`;
            }
          }
          this.tracker?.addLog(sid, { level: status, text: preview });
        }
      } catch {
        // tracker 推送失败不影响主流程
      }
    };
  }

  /** 确保 tracker 有该 agent 的会话条目：续会话复用（追加日志），否则新建 */
  private ensureSession(agent: string, toolCallId: string, task: string): string {
    const existing = this.sessionIds.get(agent);
    if (existing && this.tracker?.getRun(existing)) {
      this.tracker.updateRun(existing, {
        status: 'running',
        task,
        startedAt: Date.now(),
        completedAt: undefined,
        durationMs: undefined,
        output: undefined,
        error: undefined,
      });
      return existing;
    }
    this.tracker?.startRun({ toolCallId, toolName: 'agent_comm', agent, task, mode: 'single' });
    this.sessionIds.set(agent, toolCallId);
    return toolCallId;
  }

  /** 统一分派 await/request 的结果：question 透出、result 完成、timeout/error 标记 */
  private handleAwaitResult(sid: string, agent: string, r: AgentAwaitResult): AgentToolResult<Record<string, unknown>> {
    if (r.kind === 'question') {
      this.tracker?.addLog(sid, { level: 'question', text: r.question });
      return {
        content: [
          {
            type: 'text' as const,
            text: [
              `❓ ${agent} 提问 (${r.askCount}/3): ${r.question}`,
              '',
              '请用 agent_reply 回答，然后继续 agent_await 等待最终结果。',
            ].join('\n'),
          },
        ],
        details: { question: r },
      };
    }

    if (r.kind === 'result') {
      const result = r.result;
      const status = result.exitCode === 0 ? 'completed' : 'failed';
      this.tracker?.completeRun(sid, {
        status,
        output: result.output,
        error: result.error,
        turns: result.usage.turns,
        cost: result.usage.cost,
        model: result.model,
      });
      this.tracker?.addLog(sid, {
        level: 'done',
        text: `${result.agent} ${status === 'completed' ? '完成' : '失败'} (${result.durationMs}ms, ${result.usage.turns} 轮)`,
      });

      const icon = result.exitCode === 0 ? '✅' : '❌';
      const statusLabel = result.exitCode === 0 ? '完成' : `失败(code=${result.exitCode})`;
      const cost = result.usage.cost > 0 ? ` | $${result.usage.cost.toFixed(4)}` : '';
      const header = `${icon} ${result.agent} ${statusLabel} (${result.durationMs}ms, ${result.usage.turns} 轮${cost})`;
      const modelLine = result.model ? `模型: ${result.model}` : '';
      const errorLine = result.error ? `错误: ${result.error}` : '';
      return {
        content: [
          {
            type: 'text' as const,
            text: [header, modelLine, errorLine, '', result.output].filter(Boolean).join('\n'),
          },
        ],
        details: { result },
      };
    }

    if (r.kind === 'timeout') {
      this.tracker?.completeRun(sid, { status: 'aborted', error: '等待超时', turns: 0, cost: 0 });
      this.tracker?.addLog(sid, { level: 'error', text: `等待超时: ${agent}` });
      return {
        content: [{ type: 'text' as const, text: `⏱️ ${agent} 等待超时（会话保留，可继续通信）` }],
        details: {},
      };
    }

    // kind === 'error'
    this.tracker?.completeRun(sid, { status: 'failed', error: r.message, turns: 0, cost: 0 });
    this.tracker?.addLog(sid, { level: 'error', text: `通道错误: ${r.message}` });
    return {
      content: [{ type: 'text' as const, text: `⚠️ ${agent} 通道错误: ${r.message}` }],
      details: {},
    };
  }

  // ==================== agent_await ====================

  private registerAwait(pi: ExtensionAPI): void {
    pi.registerTool({
      name: 'agent_await',
      label: 'Agent Await',
      description: [
        '阻塞等待指定 agent 会话的下一条消息。',
        '返回提问（子 agent 需要回答，用 agent_reply 回复后继续 agent_await）或最终结果。',
      ].join(' '),
      promptSnippet: 'Wait for the next message from an agent session',
      promptGuidelines: [
        'agent_await returns either a question (kind=question, answer with agent_reply then await again) or the final result.',
        'Never answer a question inside the same tool call; always use agent_reply in a separate step.',
      ],
      parameters: Type.Object({
        agent: Type.String({ description: 'Agent 名称' }),
        timeoutMs: Type.Optional(
          Type.Number({ description: '超时毫秒数。默认 600000（10 分钟）' }),
        ),
      }),
      renderCall(args, theme) {
        return new Text(
          theme.fg('toolTitle', theme.bold('agent_await ')) +
          theme.fg('accent', args.agent),
          0, 0,
        );
      },
      renderResult(result, { expanded }, theme) {
        return renderCommResult(result, expanded, theme);
      },
      execute: async (toolCallId, params, _signal, _onUpdate) => {
        const sid = this.ensureSession(params.agent, toolCallId, '(等待回复)');
        try {
          const result = await this.messaging.await(params.agent, params.timeoutMs);
          return this.handleAwaitResult(sid, params.agent, result);
        } catch (err: any) {
          this.tracker?.completeRun(sid, { status: 'failed', error: err.message || String(err), turns: 0, cost: 0 });
          return {
            content: [{ type: 'text' as const, text: `agent_await 异常: ${err.message || err}` }],
            details: {},
          };
        }
      },
    });
  }

  // ==================== agent_reply ====================

  private registerReply(pi: ExtensionAPI): void {
    pi.registerTool({
      name: 'agent_reply',
      label: 'Agent Reply',
      description: '回答子 agent 的提问。回答后子 agent 恢复执行，用 agent_await 继续等待。',
      promptSnippet: 'Reply to an agent question',
      parameters: Type.Object({
        agent: Type.String({ description: 'Agent 名称' }),
        answer: Type.String({ description: '回答内容（尽量具体、可执行）' }),
      }),
      renderCall(args, theme) {
        const preview = args.answer.length > 60 ? args.answer.slice(0, 60) + '...' : args.answer;
        return new Text(
          theme.fg('toolTitle', theme.bold('agent_reply ')) +
          theme.fg('accent', args.agent) +
          '\n  ' + theme.fg('dim', preview),
          0, 0,
        );
      },
      renderResult(result, _opts, theme) {
        const text = result.content[0];
        return new Text(
          theme.fg('success', '✓ ') + theme.fg('dim', text?.type === 'text' ? text.text : ''),
          0, 0,
        );
      },
      execute: async (toolCallId, params, _signal, _onUpdate) => {
        const sid = this.ensureSession(params.agent, toolCallId, '(回复提问)');
        try {
          await this.messaging.reply(params.agent, params.answer);
          this.tracker?.addLog(sid, { level: 'reply', text: params.answer.slice(0, 200) });
          return {
            content: [{ type: 'text' as const, text: `已回复 ${params.agent}，子 agent 将继续执行` }],
            details: {},
          };
        } catch (err: any) {
          return {
            content: [{ type: 'text' as const, text: `agent_reply 异常: ${err.message || err}` }],
            details: {},
          };
        }
      },
    });
  }

  // ==================== agent_close ====================

  private registerClose(pi: ExtensionAPI): void {
    pi.registerTool({
      name: 'agent_close',
      label: 'Agent Close',
      description: '关闭与指定 agent 的会话（重置其对话历史）。进程保留常驻，下次通信开新会话。',
      promptSnippet: 'Close an agent session',
      parameters: Type.Object({
        agent: Type.String({ description: 'Agent 名称' }),
      }),
      renderCall(args, theme) {
        return new Text(
          theme.fg('toolTitle', theme.bold('agent_close ')) +
          theme.fg('accent', args.agent),
          0, 0,
        );
      },
      renderResult(result, _opts, theme) {
        const text = result.content[0];
        return new Text(
          theme.fg('dim', '✕ ') + theme.fg('dim', text?.type === 'text' ? text.text : ''),
          0, 0,
        );
      },
      execute: async (_toolCallId, params, _signal, _onUpdate) => {
        try {
          await this.messaging.close(params.agent);
          const sid = this.sessionIds.get(params.agent);
          if (sid && this.tracker?.getRun(sid)) {
            const run = this.tracker.getRun(sid);
            this.tracker.completeRun(sid, {
              status: 'completed',
              output: '(会话已关闭)',
              turns: run?.turns ?? 0,
              cost: run?.cost ?? 0,
            });
          }
          this.sessionIds.delete(params.agent);
          return {
            content: [{ type: 'text' as const, text: `会话已关闭: ${params.agent}（进程保留，下次通信开新会话）` }],
            details: {},
          };
        } catch (err: any) {
          return {
            content: [{ type: 'text' as const, text: `agent_close 异常: ${err.message || err}` }],
            details: {},
          };
        }
      },
    });
  }

  // ==================== agent_request ====================

  private registerRequest(pi: ExtensionAPI): void {
    pi.registerTool({
      name: 'agent_request',
      label: 'Agent Request',
      description: [
        '向指定 agent 发送任务并等待首次回复（send + await 合成）。',
        '返回提问（子 agent 需要澄清，用 agent_reply 回答后 agent_await 继续）或最终结果。',
      ].join(' '),
      promptSnippet: 'Request a task from an agent and wait for its reply',
      promptGuidelines: [
        'Use agent_request to delegate work and get the result in one step (replaces the old spawn_agent).',
        'If it returns a question, reply with agent_reply, then continue with agent_await until you get the final result.',
      ],
      parameters: Type.Object({
        agent: Type.String({ description: 'Agent 名称，对应 skills/<skill>/sub-skill/<agent>/SUB-SKILL.md' }),
        task: Type.String({ description: '分配给该 agent 的任务描述' }),
        context: Type.Optional(
          Type.String({ description: '可选上下文（追加到消息末尾），如之前 agent 的输出' }),
        ),
        model: Type.Optional(
          Type.String({ description: '可选模型覆盖。仅首次创建进程时生效' }),
        ),
        timeoutMs: Type.Optional(
          Type.Number({ description: '超时毫秒数。默认 600000（10 分钟）' }),
        ),
        skipExts: Type.Optional(
          Type.Array(Type.String(), {
            description: '子 agent 中跳过拦截的扩展名列表，如 ["confirm-edit"]',
          }),
        ),
      }),
      renderCall(args, theme) {
        const name = args.agent || '...';
        const preview = args.task
          ? (args.task.length > 60 ? args.task.slice(0, 60) + '...' : args.task)
          : '...';
        const text =
          theme.fg('toolTitle', theme.bold('agent_request ')) +
          theme.fg('accent', name) +
          '\n  ' + theme.fg('dim', preview);
        return new Text(text, 0, 0);
      },
      renderResult(result, { expanded }, theme) {
        return renderCommResult(result, expanded, theme);
      },
      execute: async (toolCallId, params, _signal, _onUpdate) => {
        const sid = this.ensureSession(params.agent, toolCallId, params.task);
        try {
          const out = await this.requestUseCase.execute({
            agent: params.agent,
            task: params.task,
            context: params.context,
            model: params.model,
            timeoutMs: params.timeoutMs,
            skipExts: params.skipExts,
            onEvent: this.makeEventForwarder(sid),
          });
          return this.handleAwaitResult(sid, params.agent, out.result);
        } catch (err: any) {
          this.tracker?.completeRun(sid, { status: 'failed', error: err.message || String(err), turns: 0, cost: 0 });
          this.tracker?.addLog(sid, { level: 'error', text: `异常: ${err.message || err}` });
          return {
            content: [{ type: 'text' as const, text: `agent_request 异常: ${err.message || err}` }],
            details: {},
          };
        }
      },
    });
  }
}

// ==================== 渲染（供 pi 工具定义引用） ====================

/** 渲染结果卡片（result / question），供 agent_await / agent_request 复用 */
export function renderCommResult(result: AgentToolResult<unknown>, expanded: boolean, theme: Theme): import('@earendil-works/pi-tui').Component {
  const details = (result.details as Record<string, unknown>) ?? {};

  // question 卡片
  if (details.question) {
    const q = details.question as { question: string; askCount: number };
    const text =
      theme.fg('error', theme.bold('❓ ')) +
      theme.fg('toolTitle', theme.bold('提问')) +
      theme.fg('dim', ` (${q.askCount}/3)`) +
      '\n' + q.question +
      '\n' + theme.fg('dim', '→ 用 agent_reply 回答后继续 agent_await');
    return new Text(text, 0, 0);
  }

  const r = details.result as AgentRunResult | undefined;
  if (!r) {
    const content = result.content[0];
    return new Text(content?.type === 'text' ? content.text : '(no output)', 0, 0);
  }

  const mdTheme = getMarkdownTheme();
  const isError = r.exitCode !== 0;
  const icon = isError ? theme.fg('error', '✗') : theme.fg('success', '✓');
  const displayItems = r.messages ? getDisplayItems(r.messages) : [];
  const finalOutput = r.messages ? getFinalOutput(r.messages) : r.output;

  if (expanded) {
    const container = new Container();
    let header = `${icon} ${theme.fg('toolTitle', theme.bold(r.agent))}`;
    if (r.error) header += ` ${theme.fg('error', `[${r.error}]`)}`;
    container.addChild(new Text(header, 0, 0));
    if (r.errorMessage) container.addChild(new Text(theme.fg('error', `Error: ${r.errorMessage}`), 0, 0));
    container.addChild(new Spacer(1));
    container.addChild(new Text(theme.fg('muted', '─── Tool Calls ───'), 0, 0));
    for (const item of displayItems) {
      if (item.type === 'toolCall') {
        container.addChild(
          new Text(theme.fg('muted', '→ ') + formatToolCall(item.name!, item.args!, theme.fg.bind(theme)), 0, 0),
        );
      }
    }
    if (finalOutput) {
      container.addChild(new Spacer(1));
      container.addChild(new Text(theme.fg('muted', '─── Output ───'), 0, 0));
      container.addChild(new Markdown(finalOutput.trim(), 0, 0, mdTheme));
    }
    const usageStr = formatUsage(r);
    if (usageStr) {
      container.addChild(new Spacer(1));
      container.addChild(new Text(theme.fg('dim', usageStr), 0, 0));
    }
    return container;
  }

  let text = `${icon} ${theme.fg('toolTitle', theme.bold(r.agent))}`;
  if (r.error) text += ` ${theme.fg('error', `[${r.error}]`)}`;
  if (displayItems.length === 0 && !finalOutput) {
    text += `\n${theme.fg('muted', '(no output)')}`;
  } else {
    const lastItems = displayItems.slice(-5);
    for (const item of lastItems) {
      if (item.type === 'toolCall') {
        text += `\n  ${theme.fg('muted', '→ ') + formatToolCall(item.name!, item.args!, theme.fg.bind(theme))}`;
      }
    }
    if (displayItems.length > 5) text += `\n${theme.fg('muted', `... ${displayItems.length - 5} more items (Ctrl+O)`)}`;
  }
  const usageStr = formatUsage(r);
  if (usageStr) text += `\n${theme.fg('dim', usageStr)}`;
  return new Text(text, 0, 0);
}
