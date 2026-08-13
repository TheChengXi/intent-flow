/**
 * @intent
 * IAgentRepository 的 data 层实现。sub-skill 发现范围 = 全局 ~/.pi/agent/skills + 项目级 .pi/skills（cwd 向上查找至 git root，收集所有存在的），再回退 ~/.pi/agent/agents/*.md（user scope）。优先级：项目级 sub-skill > 全局 sub-skill > user agent（扫描顺序 + last-wins 去重实现）。
 * 
 * 边界：目录不存在或不可读时静默跳过并计入 errors，不向上抛异常；无 frontmatter 或无 name 字段的文件忽略；deduplicate 按 (skillName, name) 键去重（跨 skill 同名可共存，同键后覆盖前）；findByName 先按 name 精确匹配（多命中时 project 优先、同级取发现列表第一个），失败后回退 skillName/name 拼接匹配；agent 名含 '/' 时不做特殊处理。options 注入 projectSkillsDirs 时跳过向上查找；cwd 选项为向上查找起点（测试用），生产默认 process.cwd()。
 * 
 * 验收条件：
 * - discoverAll('sub_skill') 能发现项目级 .pi/skills 下的 sub-agent（origin='project'），与全局目录合并、同名项目级覆盖全局
 * - findByName('test-writer') 与 findByName('tdd/test-writer') 均能解析到 tdd skill 下的 test-writer（多命中时 project 优先）
 * - 所有 I/O 错误被捕获为 errors 数组返回，不抛异常
 */




import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import type { IAgentRepository } from '../../repositories/IAgentRepository';
import type { AgentDefinition, AgentDiscoveryResult, AgentOrigin, AgentScope } from '../../entities/AgentDefinition';

// ==================== 默认路径 ====================

const DEFAULT_SKILLS_DIR = join(homedir(), '.pi', 'agent', 'skills');
const DEFAULT_USER_AGENTS_DIR = join(homedir(), '.pi', 'agent', 'agents');

// ==================== 仓库选项（用于测试注入） ====================

export interface AgentRepositoryImplOptions {
  /** skills 根目录（默认 ~/.pi/agent/skills） */
  skillsDir?: string;
  /** user agents 目录（默认 ~/.pi/agent/agents） */
  agentsDir?: string;
  /** 项目级 skills 目录（显式注入；注入时跳过 cwd 向上查找，测试用） */
  projectSkillsDirs?: string[];
  /** 向上查找项目级目录的起点（默认 process.cwd()，测试用） */
  cwd?: string;
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
  origin?: AgentOrigin,
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
    origin,
    skillName,
    filePath,
  };

  return agent;
}

// ==================== 递归扫描 sub-skill 目录 ====================

async function scanSubSkillDir(
  dir: string,
  skillName: string,
  origin: AgentOrigin,
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
      const agent = await parseAgentFile(fullPath, skillName, 'sub_skill', origin);
      if (agent) agents.push(agent);
    } else if (entryStat.isDirectory()) {
      // 递归子目录
      const subAgents = await scanSubSkillDir(fullPath, skillName, origin);
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

async function scanAllSubSkills(
  skillsDir: string,
  origin: AgentOrigin,
): Promise<{ agents: AgentDefinition[]; errors: string[] }> {
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
    const discovered = await scanSubSkillDir(subDir, skillName, origin);
    agents.push(...discovered);
  }

  return { agents, errors };
}

/** 依次扫描多个 skills 根（全局先入 → 项目级后入，last-wins 去重实现项目级覆盖全局） */
async function scanSubSkillsRoots(
  roots: Array<{ dir: string; origin: AgentOrigin }>,
): Promise<{ agents: AgentDefinition[]; errors: string[] }> {
  const agents: AgentDefinition[] = [];
  const errors: string[] = [];

  for (const { dir, origin } of roots) {
    const { agents: discovered, errors: rootErrors } = await scanAllSubSkills(dir, origin);
    agents.push(...discovered);
    errors.push(...rootErrors);
  }

  return { agents, errors };
}

// ==================== 项目级 skills 目录解析 ====================

/**
 * 从 cwd 向上查找所有存在的 .pi/skills 目录，直到 git root（.git 文件/目录）
 * 或文件系统根；不存在时返回空数组（不抛异常）。
 */
async function resolveProjectSkillsDirs(cwd: string): Promise<string[]> {
  const dirs: string[] = [];
  let current = cwd;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const candidate = join(current, '.pi', 'skills');
      const candidateStat = await stat(candidate);
      if (candidateStat.isDirectory()) dirs.push(candidate);
    } catch {
      // 目录不存在或不可读，静默跳过
    }

    // 终止条件：当前目录是 git root，或已到文件系统根
    const parent = dirname(current);
    if (parent === current) break;
    try {
      const gitStat = await stat(join(current, '.git'));
      if (gitStat.isDirectory() || gitStat.isFile()) break;
    } catch {
      // 非 git root，继续向上
    }
    current = parent;
  }

  return dirs;
}

// ==================== 去重（(skillName, name) 键，后覆盖前） ====================

function deduplicate(agents: AgentDefinition[]): AgentDefinition[] {
  const seen = new Map<string, AgentDefinition>();
  for (const agent of agents) {
    seen.set(`${agent.skillName ?? ''}::${agent.name}`, agent);
  }
  return Array.from(seen.values());
}

// ==================== 仓库实现 ====================

export class AgentRepositoryImpl implements IAgentRepository {
  private skillsDir: string;
  private agentsDir: string;
  private projectSkillsDirs?: string[];
  private cwd: string;

  constructor(options?: AgentRepositoryImplOptions) {
    this.skillsDir = options?.skillsDir ?? DEFAULT_SKILLS_DIR;
    this.agentsDir = options?.agentsDir ?? DEFAULT_USER_AGENTS_DIR;
    this.projectSkillsDirs = options?.projectSkillsDirs;
    this.cwd = options?.cwd ?? process.cwd();
  }

  /** 项目级 skills 目录：显式注入优先，否则 cwd 向上查找 */
  private getProjectSkillsDirs(): Promise<string[]> {
    if (this.projectSkillsDirs) return Promise.resolve(this.projectSkillsDirs);
    return resolveProjectSkillsDirs(this.cwd);
  }

  async discoverAll(scope: AgentScope): Promise<AgentDiscoveryResult> {
    const allErrors: string[] = [];
    let agents: AgentDefinition[] = [];

    if (scope === 'sub_skill' || scope === 'both') {
      // 全局先入 → 项目级后入（last-wins：项目级覆盖全局）
      const roots: Array<{ dir: string; origin: AgentOrigin }> = [{ dir: this.skillsDir, origin: 'global' }];
      for (const dir of await this.getProjectSkillsDirs()) {
        roots.push({ dir, origin: 'project' });
      }
      const { agents: subSkillAgents, errors } = await scanSubSkillsRoots(roots);
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

    // 1) name 精确匹配；多命中时 project 优先，同级取发现列表第一个
    const exact = agents.filter((a) => a.name === name);
    if (exact.length > 0) {
      return exact.find((a) => a.origin === 'project') ?? exact[0];
    }

    // 2) skill/name 拼接回退（去重键 (skillName, name) 保证唯一）
    return agents.find((a) => a.skillName && `${a.skillName}/${a.name}` === name) ?? null;
  }
}
