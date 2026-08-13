/**
 * @intent Agent 发现仓库接口。定义 discoverAll（按 scope 扫描 sub-skill
 * → agents/*.md 回退）和 findByName（按名查找）。预留 reload() 给 Phase 2+。
 */

import type { AgentDefinition, AgentDiscoveryResult, AgentScope } from '../entities/AgentDefinition';

export interface IAgentRepository {
  /**
   * 按 scope 扫描文件系统发现 agent。
   * sub_skill 模式：skills/<skill>/sub-skill/ 下递归查找 SUB-SKILL.md
   * user 模式：~/.pi/agent/agents/*.md
   * both 模式：sub-skill 优先 → agents/*.md 回退
   */
  discoverAll(scope: AgentScope): Promise<AgentDiscoveryResult>;

  /**
   * 按名称查找单个 agent。
   * 遍历 discoverAll 的结果找到匹配项。
   */
  findByName(name: string, scope: AgentScope): Promise<AgentDefinition | null>;

  // ==================== Phase 2+ 预留方法 ====================

  /**
   * Phase 2+：强制刷新缓存。
   * 目前每次调用实时扫描，未来可加内存缓存减少 I/O。
   */
  // reload(): Promise<void>;
}
