/**
 * @intent list_agents 工具。向 pi 注册名为 list_agents 的工具，
 * 允许 LLM 查询当前可用的 sub-agent 列表及其描述。
 * LLM 在调用 spawn_agent 前可先查一次，避免盲猜 agent 名称。
 * 依赖 DiscoverAgentsUseCase，不走直接 repository 调用（防跨层）。
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { IDiscoverAgentsUseCase } from '../../../application/useCases/DiscoverAgentsUseCase';
import type { AgentDefinition } from '../../../data/entities/AgentDefinition';

export class ListAgentsTool {
  constructor(private discoverAgents: IDiscoverAgentsUseCase) {}

  register(pi: ExtensionAPI): void {
    pi.registerTool({
      name: 'list_agents',
      label: 'List Agents',
      description: '列出所有可用的 sub-agent。按 skill 分组，返回名称、描述和可用工具。',
      parameters: Type.Object({
        skill: Type.Optional(
          Type.String({ description: '可选，按 skill 名称过滤' }),
        ),
      }),

      execute: async (_toolCallId, params, _signal, _onUpdate, _ctx) => {
        const { agents } = await this.discoverAgents.execute({ scope: 'sub_skill' });

        if (agents.length === 0) {
          return {
            content: [{ type: 'text' as const, text: '当前没有可用的 sub-agent。' }],
            details: {},
          };
        }

        const filter = (params.skill || '').trim().toLowerCase();
        let matched = agents;
        if (filter) {
          matched = agents.filter((a: AgentDefinition) => a.skillName === filter);
          if (matched.length === 0) {
            return {
              content: [{ type: 'text' as const, text: `skill "${filter}" 下没有 sub-agent。` }],
              details: {},
            };
          }
        }

        // 按 skill 分组
        const groups = new Map<string, typeof agents>();
        for (const a of matched) {
          const skill = a.skillName || '(无分组)';
          if (!groups.has(skill)) groups.set(skill, []);
          groups.get(skill)!.push(a);
        }

        const parts: string[] = [];
        for (const [skill, list] of groups) {
          parts.push(`[${skill}]`);
          for (const a of list) {
            const tools = a.tools && a.tools.length > 0 ? `工具: ${a.tools.join(', ')}` : '';
            parts.push(`  ${a.name} — ${a.description}${tools ? ` (${tools})` : ''}`);
          }
        }

        return {
          content: [{ type: 'text' as const, text: parts.join('\n') }],
          details: { count: matched.length, agents: matched.map((a: AgentDefinition) => a.name) },
        };
      },
    });
  }
}
