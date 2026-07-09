/**
 * @intent /sub-skill 命令。列出所有可用的 sub-agent，支持按 skill 名称过滤。
 */

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import type { DIContainer } from '../DIContainer';

export class SubSkillCommand {
  register(pi: ExtensionAPI, container: DIContainer): void {
    pi.registerCommand('sub-skill', {
      description: '列出 sub-agent。/sub-skill 查看全部，/sub-skill <skill> 只看该 skill 下的',
      handler: async (args, ctx) => {
        const { agents, errors } = await container.agentRepo.discoverAll('sub_skill');

        if (agents.length === 0) {
          ctx.ui.notify('未发现任何 sub-agent', 'warn');
          return;
        }

        const filter = (args || '').trim().toLowerCase();
        let msg: string;

        if (filter) {
          const matched = agents.filter((a) => a.skillName === filter);
          if (matched.length === 0) {
            ctx.ui.notify(`skill "${filter}" 下没有 sub-agent`, 'warn');
            return;
          }
          msg = `[${filter}] sub-agent (${matched.length}):\n${formatAgentList(matched)}`;
        } else {
          const grouped = groupBySkill(agents);
          const parts: string[] = [];
          for (const [skill, list] of grouped) {
            parts.push(`[${skill}] (${list.length}):\n${formatAgentList(list)}`);
          }
          msg = `全部 sub-agent (${agents.length}):\n\n${parts.join('\n\n')}`;
        }

        if (errors.length > 0) {
          msg += `\n\n发现错误:\n${errors.join('\n')}`;
        }
        ctx.ui.notify(msg, 'info');
      },
    });
  }
}

// ==================== 辅助函数 ====================

function formatAgentList(agents: Array<{ name: string; description: string; tools?: string[] }>): string {
  return agents
    .map((a) => {
      const tools = a.tools && a.tools.length > 0 ? `[${a.tools.join(', ')}]` : '无工具';
      return `  ● ${a.name}  — ${a.description}\n    工具: ${tools}`;
    })
    .join('\n');
}

function groupBySkill(agents: Array<{ skillName?: string; name: string; description: string; tools?: string[] }>): Map<string, typeof agents> {
  const map = new Map<string, typeof agents>();
  for (const a of agents) {
    const skill = a.skillName || '?';
    if (!map.has(skill)) map.set(skill, []);
    map.get(skill)!.push(a);
  }
  return map;
}
