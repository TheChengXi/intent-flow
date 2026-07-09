/**
 * SubSkillRepository 集成测试
 *
 * 用临时目录模拟 ~/.pi/agent/skills/ 和 ~/.pi/agent/agents/ 文件结构，
 * 测试 agent 发现、frontmatter 解析、include/ 知识库注入、递归扫描、去重。
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SubSkillRepository } from './SubSkillRepository';
import type { AgentScope } from '../../../data/entities/AgentDefinition';

// ==================== 辅助函数 ====================

interface TempEnv {
  root: string;
  skillsDir: string;
  agentsDir: string;
}

function createTempEnv(): TempEnv {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccd-pi-test-'));
  const skillsDir = path.join(root, 'skills');
  const agentsDir = path.join(root, 'agents');
  fs.mkdirSync(skillsDir, { recursive: true });
  fs.mkdirSync(agentsDir, { recursive: true });
  return { root, skillsDir, agentsDir };
}

function cleanupTempEnv(env: TempEnv): void {
  fs.rmSync(env.root, { recursive: true, force: true });
}

/** 创建 sub-skill agent 的目录和 SUB-SKILL.md 文件路径 */
function subSkillPath(
  skillsDir: string,
  skillName: string,
  agentName: string,
  subDir?: string,
): string {
  const parts = [skillsDir, skillName, 'sub-skill'];
  if (subDir) parts.push(subDir);
  parts.push(agentName, 'SUB-SKILL.md');
  return path.join(...parts);
}

/** 写入 SUB-SKILL.md 文件 */
function writeSubSkillMd(filePath: string, name: string, opts?: {
  description?: string;
  tools?: string;
  model?: string;
  body?: string;
}): void {
  const lines = [
    '---',
    `name: ${name}`,
    `description: ${opts?.description ?? 'test agent'}`,
  ];
  if (opts?.tools) lines.push(`tools: ${opts.tools}`);
  if (opts?.model) lines.push(`model: ${opts.model}`);
  lines.push('---', '', opts?.body ?? `# ${name}\n\nTest body.`);

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, lines.join('\n'), 'utf-8');
}

/** 创建 include/ 文件 */
function writeInclude(agentDir: string, fileName: string, content: string): void {
  const dir = path.join(agentDir, 'include');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, fileName), content, 'utf-8');
}

// ==================== 测试 ====================

describe('SubSkillRepository', () => {
  let env: TempEnv;
  let repo: SubSkillRepository;

  beforeEach(() => {
    env = createTempEnv();
    repo = new SubSkillRepository({
      skillsDir: env.skillsDir,
      agentsDir: env.agentsDir,
    });
  });

  afterEach(() => {
    cleanupTempEnv(env);
  });

  // ── 不同 scope ─────────────────────────────────

  describe('discoverAll', () => {
    it('sub_skill scope 返回 sub-skill 目录下的 agent', async () => {
      writeSubSkillMd(subSkillPath(env.skillsDir, 'my-skill', 'scout'), 'scout', {
        description: 'Codebase recon',
        tools: 'read,grep,find',
      });
      writeSubSkillMd(subSkillPath(env.skillsDir, 'my-skill', 'planner'), 'planner', {
        description: 'Plan implementation',
        model: 'claude-sonnet-4',
      });

      const result = await repo.discoverAll('sub_skill');

      expect(result.agents).toHaveLength(2);
      expect(result.agents.map((a) => a.name).sort()).toEqual(['planner', 'scout']);
      expect(result.agents[0].source).toBe('sub_skill');
      expect(result.agents[0].skillName).toBe('my-skill');
    });

    it('user scope 只返回 user agents 目录的 agent', async () => {
      fs.writeFileSync(path.join(env.agentsDir, 'worker.md'), [
        '---',
        'name: worker',
        'description: General worker',
        '---',
        '',
        '# Worker',
      ].join('\n'), 'utf-8');

      // 同时有 sub-skill agent，但 user scope 不应该找到它
      writeSubSkillMd(subSkillPath(env.skillsDir, 'any', 'ghost'), 'ghost', {
        description: 'Should not appear',
      });

      const result = await repo.discoverAll('user');

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].name).toBe('worker');
      expect(result.agents[0].source).toBe('user_agent');
    });

    it('both scope 同时加载两个来源，user 作为回退', async () => {
      // 只有 user agent，没有 sub-skill
      fs.writeFileSync(path.join(env.agentsDir, 'fallback.md'), [
        '---',
        'name: fallback-agent',
        'description: Fallback',
        '---',
        '',
        '# Fallback',
      ].join('\n'), 'utf-8');

      const result = await repo.discoverAll('both');

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].name).toBe('fallback-agent');
      expect(result.agents[0].source).toBe('user_agent');
    });

    it('both scope 同时加载两个来源，各自保留', async () => {
      // user agent（不同名）
      fs.writeFileSync(path.join(env.agentsDir, 'user-only.md'), [
        '---',
        'name: user-only',
        'description: Only in user',
        '---',
        '',
        '# User',
      ].join('\n'), 'utf-8');

      // sub-skill agent（不同名）
      writeSubSkillMd(subSkillPath(env.skillsDir, 'my-skill', 'scout'), 'scout', {
        description: 'From sub-skill',
      });

      const result = await repo.discoverAll('both');

      const names = result.agents.map((a) => a.name).sort();
      expect(names).toEqual(['scout', 'user-only']);
      expect(result.agents.find((a) => a.name === 'user-only')!.source).toBe('user_agent');
      expect(result.agents.find((a) => a.name === 'scout')!.source).toBe('sub_skill');
    });

    it('both scope 下同名时 sub-skill 覆盖 user', async () => {
      // user agent
      fs.writeFileSync(path.join(env.agentsDir, 'common.md'), [
        '---',
        'name: common',
        'description: user version',
        '---',
        '',
        '# User Common',
      ].join('\n'), 'utf-8');

      // sub-skill（同名，应优先）
      writeSubSkillMd(subSkillPath(env.skillsDir, 'my-skill', 'common'), 'common', {
        description: 'sub-skill version',
      });

      const result = await repo.discoverAll('both');

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].name).toBe('common');
      expect(result.agents[0].description).toBe('sub-skill version');
      expect(result.agents[0].source).toBe('sub_skill');
    });

    it('目录不存在时返回空列表', async () => {
      const emptyRepo = new SubSkillRepository({
        skillsDir: path.join(env.root, 'ghost-skills'),
        agentsDir: path.join(env.root, 'ghost-agents'),
      });

      const result = await emptyRepo.discoverAll('both');
      expect(result.agents).toEqual([]);
      expect(result.errors).toEqual([]);
    });
  });

  // ── 递归扫描 ────────────────────────────────

  describe('递归子目录扫描', () => {
    it('扫描 sub-skill 下嵌套子目录的 agent', async () => {
      // skills/my-skill/sub-skill/tdd/test-writer/SUB-SKILL.md
      const nestedPath = subSkillPath(env.skillsDir, 'my-skill', 'test-writer', 'tdd');
      writeSubSkillMd(nestedPath, 'tdd-test-writer', {
        description: 'Write tests',
        tools: 'read,write,edit',
      });

      // 同时有一级深度的
      writeSubSkillMd(subSkillPath(env.skillsDir, 'my-skill', 'scout'), 'scout', {
        description: 'Recon',
      });

      const result = await repo.discoverAll('sub_skill');

      expect(result.agents).toHaveLength(2);
      const names = result.agents.map((a) => a.name).sort();
      expect(names).toEqual(['scout', 'tdd-test-writer']);
    });
  });

  // ── include/ 知识库 ─────────────────────────────

  describe('include/ 知识库', () => {
    it('include 目录下的 .md 文件自动注入到 systemPrompt', async () => {
      const fp = subSkillPath(env.skillsDir, 'my-skill', 'scout');
      writeSubSkillMd(fp, 'scout', { body: '# Scout\n\nCore prompt.' });

      const agentDir = path.dirname(fp);
      writeInclude(agentDir, 'conventions.md', '# Conventions\n\nUse TypeScript.');

      const result = await repo.discoverAll('sub_skill');

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].systemPrompt).toContain('Core prompt.');
      expect(result.agents[0].systemPrompt).toContain('Use TypeScript.');
      expect(result.agents[0].systemPrompt).toContain('## 参考规范');
    });

    it('没有 include 目录时 systemPrompt 不变', async () => {
      writeSubSkillMd(subSkillPath(env.skillsDir, 'my-skill', 'plain'), 'plain', {
        body: '# Plain\n\nNo includes.',
      });

      const result = await repo.discoverAll('sub_skill');

      expect(result.agents[0].systemPrompt).toBe('# Plain\n\nNo includes.');
    });

    it('include 子目录下的 .md 也被递归加载', async () => {
      const fp = subSkillPath(env.skillsDir, 'my-skill', 'agent-a');
      writeSubSkillMd(fp, 'agent-a', { body: '# Agent A' });

      const agentDir = path.dirname(fp);
      // 在 include/subdir/ 下放一个 .md
      const subDir = path.join(agentDir, 'include', 'subdir');
      fs.mkdirSync(subDir, { recursive: true });
      fs.writeFileSync(path.join(subDir, 'nested.md'), '# Nested\n\nDeep content.', 'utf-8');

      const result = await repo.discoverAll('sub_skill');

      expect(result.agents[0].systemPrompt).toContain('Deep content.');
    });
  });

  // ── findByName ──────────────────────────────────

  describe('findByName', () => {
    it('按名称查找存在的 agent', async () => {
      writeSubSkillMd(subSkillPath(env.skillsDir, 'my-skill', 'scout'), 'scout', {
        description: 'Recon agent',
      });

      const agent = await repo.findByName('scout', 'sub_skill');

      expect(agent).not.toBeNull();
      expect(agent!.name).toBe('scout');
      expect(agent!.description).toBe('Recon agent');
    });

    it('不存在的名称返回 null', async () => {
      writeSubSkillMd(subSkillPath(env.skillsDir, 'my-skill', 'scout'), 'scout');

      const agent = await repo.findByName('ghost', 'sub_skill');

      expect(agent).toBeNull();
    });
  });
});
