/**
 * @intent
 * IAgentRepository 的 pi 特有实现。按 sub-skill 优先
 * （skills/<skill>/sub-skill/ 下递归查找 SUB-SKILL.md）→
 * ~/.pi/agent/agents/*.md 回退的优先级发现 agent。
 * 支持 frontmatter 解析、同名去重（后覆盖前）。
 * @location adapter/pi/repositories/
 * 构造函数接受可选的 paths 参数，方便测试注入临时目录。
 * Phase 1 完整实现。
 */


import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { IAgentRepository } from '../../../data/repositories/IAgentRepository';
import type { AgentDefinition, AgentDiscoveryResult, AgentScope } from '../../../data/entities/AgentDefinition';

// ==================== 默认路径 ====================

const DEFAULT_SKILLS_DIR = join(homedir(), '.pi', 'agent', 'skills');
const DEFAULT_USER_AGENTS_DIR = join(homedir(), '.pi', 'agent', 'agents');

// ==================== 仓库选项（用于测试注入） ====================

export interface SubSkillRepositoryOptions {
  /** skills 根目录（默认 ~/.pi/agent/skills） */
  skillsDir?: string;
  /** user agents 目录（默认 ~/.pi/agent/agents） */
  agentsDir?: string;
}

// ==================== Frontmatter 解析 ====================

interface ParsedFrontmatter {
  fields: Record<string, string>;
  body: string;
}

function parseFrontmatter(content: string): ParsedFrontmatter | null {
  // 兼容 \r\n（Windows）和 \n（Unix）换行
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return null;

  const fields: Record<string, string> = {};
  for (const line of match[1].split(/\r?\n/)) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    fields[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }

  return { fields, body: match[2].trim() };
}

// ==================== Agent 文件解析 ====================

async function parseAgentFile(
  filePath: string,
  skillName: string | undefined,
  source: AgentDefinition['source'],
): Promise<AgentDefinition | null> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return null;
  }

  const parsed = parseFrontmatter(content);
  if (!parsed) return null;

  const name = parsed.fields['name'];
  if (!name) return null;

  const agent: AgentDefinition = {
    name,
    description: parsed.fields['description'] ?? '',
    tools: parsed.fields['tools']
      ? parsed.fields['tools'].split(',').map((t) => t.trim()).filter(Boolean)
      : undefined,
    model: parsed.fields['model'] || undefined,
    systemPrompt: parsed.body,
    source,
    skillName,
    filePath,
  };

  return agent;
}

// ==================== 递归扫描 sub-skill 目录 ====================

async function scanSubSkillDir(
  dir: string,
  skillName: string,
): Promise<AgentDefinition[]> {
  const agents: AgentDefinition[] = [];

  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return agents;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);

    let entryStat;
    try {
      entryStat = await stat(fullPath);
    } catch {
      continue;
    }

    if (entryStat.isFile() && entry.toLowerCase() === 'sub-skill.md') {
      // 直接是 SUB-SKILL.md 文件
      const agent = await parseAgentFile(fullPath, skillName, 'sub_skill');
      if (agent) agents.push(agent);
    } else if (entryStat.isDirectory()) {
      // 递归子目录
      const subAgents = await scanSubSkillDir(fullPath, skillName);
      agents.push(...subAgents);
    }
  }

  return agents;
}

// ==================== 扫描 user agents ====================

async function scanUserAgentDir(agentsDir: string): Promise<AgentDefinition[]> {
  const agents: AgentDefinition[] = [];

  let entries: string[];
  try {
    entries = await readdir(agentsDir);
  } catch {
    return agents;
  }

  for (const name of entries) {
    if (!name.endsWith('.md')) continue;
    const filePath = join(agentsDir, name);
    const agent = await parseAgentFile(filePath, undefined, 'user_agent');
    if (agent) agents.push(agent);
  }

  return agents;
}

// ==================== 扫描所有 skill 的 sub-skill 目录 ====================

async function scanAllSubSkills(skillsDir: string): Promise<{ agents: AgentDefinition[]; errors: string[] }> {
  const agents: AgentDefinition[] = [];
  const errors: string[] = [];

  let skillDirs: string[];
  try {
    skillDirs = await readdir(skillsDir);
  } catch (err: any) {
    if (err.code === 'ENOENT') return { agents, errors };
    errors.push(`${skillsDir}: ${err.message}`);
    return { agents, errors };
  }

  for (const skillName of skillDirs) {
    const subDir = join(skillsDir, skillName, 'sub-skill');
    const discovered = await scanSubSkillDir(subDir, skillName);
    agents.push(...discovered);
  }

  return { agents, errors };
}

// ==================== 去重（后覆盖前） ====================

function deduplicate(agents: AgentDefinition[]): AgentDefinition[] {
  const seen = new Map<string, AgentDefinition>();
  for (const agent of agents) {
    seen.set(agent.name, agent);
  }
  return Array.from(seen.values());
}

// ==================== 仓库实现 ====================

export class SubSkillRepository implements IAgentRepository {
  private skillsDir: string;
  private agentsDir: string;

  constructor(options?: SubSkillRepositoryOptions) {
    this.skillsDir = options?.skillsDir ?? DEFAULT_SKILLS_DIR;
    this.agentsDir = options?.agentsDir ?? DEFAULT_USER_AGENTS_DIR;
  }

  async discoverAll(scope: AgentScope): Promise<AgentDiscoveryResult> {
    const allErrors: string[] = [];
    let agents: AgentDefinition[] = [];

    if (scope === 'sub_skill' || scope === 'both') {
      const { agents: subSkillAgents, errors } = await scanAllSubSkills(this.skillsDir);
      agents.push(...subSkillAgents);
      allErrors.push(...errors);
    }

    if (scope === 'user') {
      const userAgents = await scanUserAgentDir(this.agentsDir);
      agents.push(...userAgents);
    } else if (scope === 'both') {
      // both 模式：user agents 先入 → sub-skill 后入（同名时 sub-skill 覆盖）
      // deduplicate 是 last-wins 策略，所以后入的 sub-skill 会覆盖同名的 user agent
      const userAgents = await scanUserAgentDir(this.agentsDir);
      agents.unshift(...userAgents);
    }

    return { agents: deduplicate(agents), errors: allErrors };
  }

  async findByName(name: string, scope: AgentScope): Promise<AgentDefinition | null> {
    const { agents } = await this.discoverAll(scope);
    return agents.find((a) => a.name === name) ?? null;
  }
}
