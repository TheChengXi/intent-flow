/**
 * @intent subagent 工具。向 pi 注册名为 subagent 的工具，
 * 支持单次/链式/并行三种模式。Phase 1 实现单次模式，Phase 1.5 实现 chain 模式，
 * Phase 2+ 实现并行模式。agent 名称直接使用 SUB-SKILL.md 的原始 name，不做别名映射。
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { ISpawnAgentUseCase } from '../../../application/useCases/SpawnAgentUseCase';
import type { IAgentRepository } from '../../../data/repositories/IAgentRepository';
import type { ISubProcessRunner } from '../../../data/repositories/ISubProcessRunner';

export class SubagentTool {
  constructor(
    private useCase: ISpawnAgentUseCase,
    private agentRepo: IAgentRepository,
    private runner: ISubProcessRunner,
  ) {}

  register(pi: ExtensionAPI): void {
    pi.registerTool({
      name: 'subagent',
      label: 'Subagent',
      description: [
        'Delegate tasks to specialized subagents with isolated context.',
        'Modes: single (agent + task), parallel (tasks array) - Phase 1 only single mode.',
        'Agents discovered from skills/<skill>/sub-skill/<agent>/SUB-SKILL.md',
      ].join(' '),
      parameters: Type.Object({
        agent: Type.Optional(
          Type.String({ description: 'Name of the agent to invoke (for single mode)' }),
        ),
        task: Type.Optional(
          Type.String({ description: 'Task to delegate (for single mode)' }),
        ),
        skipExts: Type.Optional(
          Type.Array(Type.String(), {
            description: '子 agent 中跳过拦截的扩展名列表，如 ["confirm-edit"]',
          }),
        ),
        tasks: Type.Optional(
          Type.Array(
            Type.Object({
              agent: Type.String(),
              task: Type.String(),
            }),
            { description: 'Phase 2+: Array of {agent, task} for parallel execution' },
          ),
        ),
        chain: Type.Optional(
          Type.Array(
            Type.Object({
              agent: Type.String(),
              task: Type.String({ description: 'Task with optional {previous} placeholder' }),
            }),
            { description: 'Chain mode: Array of {agent, task} for sequential execution. {previous} is replaced with the previous step\'s output.' },
          ),
        ),
      }),

      execute: async (_toolCallId, params, _signal, onUpdate, ctx) => {
        // ── Chain 模式（Phase 1.5） ─────────────────
        if (params.chain && params.chain.length > 0) {
          try {
            const result = await this.runner.runChain(
              params.chain.map((step: any) => ({
                agent: step.agent,
                task: step.task,
              })),
            );

            // 格式化报告
            const report = this.formatChainReport(result);
            return {
              content: [{ type: 'text' as const, text: report }],
              details: { chainResult: result },
            };
          } catch (err: any) {
            return {
              content: [{ type: 'text' as const, text: `chain 执行失败: ${err.message}` }],
              details: {},
              isError: true,
            };
          }
        }

        // ── 单次模式（Phase 1） ─────────────────
        if (params.agent && params.task) {
          try {
            const result = await this.useCase.execute({
              agent: params.agent,
              task: params.task,
              skipExts: params.skipExts,
              cwd: ctx.cwd,
            });

            return {
              content: [{ type: 'text' as const, text: result.result.output || '(no output)' }],
              details: { result: result.result },
            };
          } catch (err: any) {
            return {
              content: [{ type: 'text' as const, text: `subagent failed: ${err.message}` }],
              details: {},
              isError: true,
            };
          }
        }

        // ── 未匹配任何模式 ─────────────────
        return {
          content: [{ type: 'text' as const, text: '请指定执行模式：single (agent + task) 或 chain (chain[])。' }],
          details: {},
          isError: true,
        };
      },
    });
  }

  // ==================== 报告格式化 ====================

  private formatChainReport(result: {
    results: Array<{ agent: string; output: string; exitCode: number; usage: { turns: number; cost: number } }>;
    failedIndex: number | null;
  }): string {
    const parts: string[] = [];
    parts.push(`Chain 执行完成 (${result.results.length} 步)`);
    parts.push('');

    for (let i = 0; i < result.results.length; i++) {
      const r = result.results[i];
      const icon = r.exitCode === 0 ? '✓' : '✗';
      const status = r.exitCode === 0 ? '通过' : `失败(code=${r.exitCode})`;
      const cost = r.usage.cost > 0 ? ` | $${r.usage.cost.toFixed(4)}` : '';
      parts.push(`  ${i + 1}. ${icon} ${r.agent} — ${status} (${r.usage.turns} 轮${cost})`);
    }

    if (result.failedIndex !== null) {
      parts.push('');
      parts.push(`❌ 第 ${result.failedIndex + 1} 步失败，chain 终止`);
      parts.push('');
      parts.push(`失败步骤输出:`);
      parts.push(result.results[result.failedIndex].output.slice(0, 2000));
    } else {
      parts.push('');
      parts.push('✅ 全部通过');
      // 显示最后一步的输出
      const last = result.results[result.results.length - 1];
      if (last.output) {
        parts.push('');
        parts.push(`最终输出:`);
        parts.push(last.output.slice(0, 2000));
      }
    }

    return parts.join('\n');
  }
}
