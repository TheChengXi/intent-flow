/**
 * @intent spawn_agent 工具。封装 SpawnAgentUseCase，向 pi 注册
 * 名为 spawn_agent 的工具。Phase 1 完整实现，含 TUI 渲染。
 * Phase 1.5 新增：子进程中间事件实时可视化（widget + onUpdate 流式推送）。
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { Container, Markdown, Spacer, Text } from '@earendil-works/pi-tui';
import { getMarkdownTheme } from '@earendil-works/pi-coding-agent';
import type { ISpawnAgentUseCase } from '../../../application/useCases/SpawnAgentUseCase';
import type { AgentRunResult } from '../../../data/entities/AgentRunResult';

// ==================== 渲染辅助函数 ====================

function formatUsage(result: AgentRunResult, theme: { fg: (c: string, t: string) => string }): string {
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
  fg: (c: string, t: string) => string,
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

// ==================== 工具注册 ====================

export class SpawnAgentTool {
  constructor(private useCase: ISpawnAgentUseCase) {}

  register(pi: ExtensionAPI): void {
    pi.registerTool({
      name: 'spawn_agent',
      label: 'Spawn Agent',
      description: [
        '在隔离子进程中运行一个 agent。',
        'agent 由 skills/<skill>/sub-skill/<agent>/SUB-SKILL.md 定义，',
        'include/ 目录下的 .md 自动注入为参考规范。',
      ].join(' '),
      promptSnippet: 'Spawn isolated sub-agents for delegated work',
      promptGuidelines: [
        'Use spawn_agent when a task needs an isolated context separate from the main session.',
        'Chain agents by passing the previous agent\'s output as context to the next.',
      ],
      parameters: Type.Object({
        agent: Type.String({
          description: 'Agent 名称，对应 skills/<skill>/sub-skill/<agent>/SUB-SKILL.md',
        }),
        task: Type.String({
          description: '分配给该 agent 的任务描述',
        }),
        context: Type.Optional(
          Type.String({
            description: '可选上下文（如上一步 agent 的输出），会追加到 system prompt 中',
          }),
        ),
        model: Type.Optional(
          Type.String({
            description: '可选模型覆盖。不传则使用 agent 定义或默认模型',
          }),
        ),
        timeoutMs: Type.Optional(
          Type.Number({
            description: '超时毫秒数。默认 600000（10 分钟）',
          }),
        ),
        skipExts: Type.Optional(
          Type.Array(Type.String(), {
            description: '子 agent 中跳过拦截的扩展名列表，如 ["confirm-edit"]',
          }),
        ),
      }),

      // ── renderCall：工具调用时在终端显示 ────────

      renderCall(args, theme, _context) {
        const name = args.agent || '...';
        const preview = args.task
          ? (args.task.length > 60 ? args.task.slice(0, 60) + '...' : args.task)
          : '...';
        const text =
          theme.fg('toolTitle', theme.bold('spawn_agent ')) +
          theme.fg('accent', name) +
          '\n  ' + theme.fg('dim', preview);
        return new Text(text, 0, 0);
      },

      // ── renderResult：工具返回后在终端显示 ──────

      renderResult(result, { expanded }, theme, _context) {
        const r = result.details?.result as AgentRunResult | undefined;
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
          // ── 展开视图 ──
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
          const usageStr = formatUsage(r, theme);
          if (usageStr) {
            container.addChild(new Spacer(1));
            container.addChild(new Text(theme.fg('dim', usageStr), 0, 0));
          }
          return container;
        }

        // ── 折叠视图 ──
        let text = `${icon} ${theme.fg('toolTitle', theme.bold(r.agent))}`;
        if (r.error) text += ` ${theme.fg('error', `[${r.error}]`)}`;
        if (displayItems.length === 0 && !finalOutput) {
          text += `\n${theme.fg('muted', '(no output)')}`;
        } else {
          // 显示最后 5 个工具调用
          const lastItems = displayItems.slice(-5);
          for (const item of lastItems) {
            if (item.type === 'toolCall') {
              text += `\n  ${theme.fg('muted', '→ ') + formatToolCall(item.name!, item.args!, theme.fg.bind(theme))}`;
            }
          }
          if (displayItems.length > 5) text += `\n${theme.fg('muted', `... ${displayItems.length - 5} more items (Ctrl+O)`)}`;
        }
        const usageStr = formatUsage(r, theme);
        if (usageStr) text += `\n${theme.fg('dim', usageStr)}`;
        return new Text(text, 0, 0);
      },

      // ── execute ──────────────────────────────────

      execute: async (_toolCallId, params, _signal, onUpdate, ctx) => {
        const agentName = params.agent;

        // ── 实时状态：widget + 状态栏 ──
        ctx.ui.setStatus('subagent', `${agentName} 运行中...`);
        ctx.ui.setWidget('subagent', [
          `── 子进程: ${agentName} ──`,
          '⏳ 启动中...',
          `任务: ${params.task.slice(0, 80)}${params.task.length > 80 ? '...' : ''}`,
        ], { placement: 'aboveEditor' });

        try {
          const result = await this.useCase.execute({
            agent: agentName,
            task: params.task,
            context: params.context,
            model: params.model,
            timeoutMs: params.timeoutMs,
            skipExts: params.skipExts,
            cwd: ctx.cwd,
            onEvent: (event) => {
              // 工具调用事件 → 更新 widget
              if (event.type === 'tool_execution_start') {
                const ev = event as any;
                const args = ev.args ? JSON.stringify(ev.args).slice(0, 60) : '';
                ctx.ui.setWidget('subagent', [
                  `── 子进程: ${agentName} ──`,
                  `🔧 ${ev.toolName} ${args}`,
                ]);
                // 关键节点也推到 onUpdate（让 LLM 感知进度）
                onUpdate?.({
                  content: [{ type: 'text' as const, text: `[${agentName}] 调用工具: ${ev.toolName}` }],
                  details: {} as any,
                });
              } else if (event.type === 'message_start') {
                ctx.ui.setWidget('subagent', [
                  `── 子进程: ${agentName} ──`,
                  '🤔 思考中...',
                ]);
              }
            },
          });

          const r = result.result;
          const icon = r.exitCode === 0 ? '✅' : '❌';
          const statusLabel = r.exitCode === 0 ? '完成' : `失败(code=${r.exitCode})`;
          const cost = r.usage.cost > 0 ? ` | $${r.usage.cost.toFixed(4)}` : '';
          const header = `${icon} ${r.agent} ${statusLabel} (${r.durationMs}ms, ${r.usage.turns} 轮${cost})`;
          const modelLine = r.model ? `模型: ${r.model}` : '';
          const errorLine = r.error ? `错误: ${r.error}` : '';

          ctx.ui.setStatus('subagent', `${agentName} ${statusLabel}`);
          ctx.ui.setWidget('subagent', [
            `── 子进程: ${agentName} ──`,
            `${icon} ${statusLabel} (${r.durationMs}ms, ${r.usage.turns} 轮${cost})`,
          ]);

          return {
            content: [
              {
                type: 'text' as const,
                text: [header, modelLine, errorLine, '', r.output].filter(Boolean).join('\n'),
              },
            ],
            details: { result: r },
          };
        } catch (err: any) {
          ctx.ui.setStatus('subagent', `${agentName} ❌ 异常`);
          ctx.ui.setWidget('subagent', [
            `── 子进程: ${agentName} ──`,
            `❌ ${err.message || err}`,
          ]);
          return {
            content: [{ type: 'text' as const, text: `spawn_agent 异常: ${err.message || err}` }],
            details: {},
            isError: true,
          };
        }
      },
    });
  }
}
