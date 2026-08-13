/**
 * @intent
 * AgentRepositoryImpl 的仓库层单测。用 mkdtemp 真实临时目录注入构造器 options（skillsDir/projectSkillsDirs/cwd），验证多目录发现、优先级与去重、名称解析。不 mock 文件系统（仓库即 IO 边界）。
 * 
 * 边界：每个测试独立临时目录，afterEach 清理；构造器注入 projectSkillsDirs 时跳过向上查找（测试不依赖真实 cwd）。
 * 
 * 验收条件：
 * - 覆盖：仅项目级发现（origin='project'）、全局+项目级同名项目级覆盖、跨 skill 同名共存、findByName 裸名多命中 project 优先、skill/name 别名命中、不存在返回 null、目录缺失静默跳过、cwd 向上查找与 git root 截断
 * - 每个测试一个关注点，测公开接口行为
 */

import { describe, it, expect, afterEach } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AgentRepositoryImpl } from './AgentRepositoryImpl';

// ==================== Helper ====================

/** 在 skills 根下创建 <skill>/sub-skill/<agent>/SUB-SKILL.md，返回 agent 定义关键信息 */
async function writeAgent(
  root: string,
  skill: string,
  agentName: string,
  description = '测试 agent',
): Promise<void> {
  const dir = join(root, skill, 'sub-skill', agentName);
  await mkdir(dir, { recursive: true });
  const fm = `name: ${agentName}\ndescription: ${description}`;
  await writeFile(join(dir, 'SUB-SKILL.md'), `---\n${fm}\n---\n\nsystem prompt body`, 'utf-8');
}

/** 每个测试独立临时目录，afterEach 清理 */
let tmpRoot: string;

async function makeTmpRoot(): Promise<string> {
  tmpRoot = await mkdtemp(join(tmpdir(), 'iflow-agent-repo-test-'));
  return tmpRoot;
}

afterEach(async () => {
  if (tmpRoot) {
    await rm(tmpRoot, { recursive: true, force: true });
    tmpRoot = '';
  }
});

// ==================== 用例 ====================

describe('AgentRepositoryImpl 多目录发现', () => {
  it('仅项目级目录有 sub-skill 时能发现（origin=project）', async () => {
    const root = await makeTmpRoot();
    const globalSkills = join(root, 'global-skills');
    const projectSkills = join(root, 'project-skills');
    await writeAgent(projectSkills, 'tdd', 'test-writer');

    const repo = new AgentRepositoryImpl({ skillsDir: globalSkills, projectSkillsDirs: [projectSkills] });
    const { agents, errors } = await repo.discoverAll('sub_skill');

    expect(errors).toEqual([]);
    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe('test-writer');
    expect(agents[0].skillName).toBe('tdd');
    expect(agents[0].origin).toBe('project');
  });

  it('全局 + 项目级同名同 skill：只留一个且项目级覆盖', async () => {
    const root = await makeTmpRoot();
    const globalSkills = join(root, 'global-skills');
    const projectSkills = join(root, 'project-skills');
    await writeAgent(globalSkills, 'tdd', 'test-writer', '全局版本');
    await writeAgent(projectSkills, 'tdd', 'test-writer', '项目版本');

    const repo = new AgentRepositoryImpl({ skillsDir: globalSkills, projectSkillsDirs: [projectSkills] });
    const { agents } = await repo.discoverAll('sub_skill');

    expect(agents).toHaveLength(1);
    expect(agents[0].origin).toBe('project');
    expect(agents[0].description).toBe('项目版本');
  });

  it('跨 skill 同名 agent 共存（(skillName, name) 去重）', async () => {
    const root = await makeTmpRoot();
    const globalSkills = join(root, 'global-skills');
    const projectSkills = join(root, 'project-skills');
    await writeAgent(globalSkills, 'web', 'test-writer', 'web 版本');
    await writeAgent(projectSkills, 'tdd', 'test-writer', 'tdd 版本');

    const repo = new AgentRepositoryImpl({ skillsDir: globalSkills, projectSkillsDirs: [projectSkills] });
    const { agents } = await repo.discoverAll('sub_skill');

    expect(agents).toHaveLength(2);
    const names = agents.map((a) => `${a.skillName}/${a.name}`).sort();
    expect(names).toEqual(['tdd/test-writer', 'web/test-writer']);
  });

  it('目录不存在时返回空结果 + 空 errors，不抛异常', async () => {
    const root = await makeTmpRoot();
    const missing = join(root, 'no-such-dir');

    const repo = new AgentRepositoryImpl({ skillsDir: missing, projectSkillsDirs: [missing] });
    const { agents, errors } = await repo.discoverAll('sub_skill');

    expect(agents).toEqual([]);
    expect(errors).toEqual([]);
  });
});

describe('AgentRepositoryImpl 名称解析', () => {
  it('裸名多命中（跨 skill）时返回 project 来源', async () => {
    const root = await makeTmpRoot();
    const globalSkills = join(root, 'global-skills');
    const projectSkills = join(root, 'project-skills');
    await writeAgent(globalSkills, 'web', 'test-writer', 'web 版本');
    await writeAgent(projectSkills, 'tdd', 'test-writer', 'tdd 版本');

    const repo = new AgentRepositoryImpl({ skillsDir: globalSkills, projectSkillsDirs: [projectSkills] });
    const agent = await repo.findByName('test-writer', 'sub_skill');

    expect(agent).not.toBeNull();
    expect(agent!.skillName).toBe('tdd');
    expect(agent!.origin).toBe('project');
  });

  it('skill/name 路径式名称可解析', async () => {
    const root = await makeTmpRoot();
    const globalSkills = join(root, 'global-skills');
    const projectSkills = join(root, 'project-skills');
    await writeAgent(projectSkills, 'tdd', 'test-writer');

    const repo = new AgentRepositoryImpl({ skillsDir: globalSkills, projectSkillsDirs: [projectSkills] });
    const agent = await repo.findByName('tdd/test-writer', 'sub_skill');

    expect(agent).not.toBeNull();
    expect(agent!.name).toBe('test-writer');
    expect(agent!.skillName).toBe('tdd');
  });

  it('不存在的 agent 返回 null', async () => {
    const root = await makeTmpRoot();
    const globalSkills = join(root, 'global-skills');
    const projectSkills = join(root, 'project-skills');
    await writeAgent(projectSkills, 'tdd', 'test-writer');

    const repo = new AgentRepositoryImpl({ skillsDir: globalSkills, projectSkillsDirs: [projectSkills] });
    const agent = await repo.findByName('no-such-agent', 'sub_skill');

    expect(agent).toBeNull();
  });
});

describe('AgentRepositoryImpl 项目级目录定位（cwd 向上查找）', () => {
  it('从嵌套 cwd 向上找到祖先 .pi/skills，git root 截断不再向上', async () => {
    const root = await makeTmpRoot();

    // git root 内：repo/.pi/skills 应被发现
    const repoRoot = join(root, 'repo');
    await writeAgent(join(repoRoot, '.pi', 'skills'), 'skill-x', 'agent-x');
    await mkdir(join(repoRoot, '.git'), { recursive: true });
    const nestedCwd = join(repoRoot, 'sub', 'deep');
    await mkdir(nestedCwd, { recursive: true });

    // git root 之外：root/.pi/skills 不应被发现（截断）
    await writeAgent(join(root, '.pi', 'skills'), 'skill-y', 'agent-y');

    // 不注入 projectSkillsDirs，走 cwd 向上查找
    const repo = new AgentRepositoryImpl({ skillsDir: join(root, 'no-global'), cwd: nestedCwd });
    const { agents } = await repo.discoverAll('sub_skill');

    expect(agents).toHaveLength(1);
    expect(agents[0].name).toBe('agent-x');
    expect(agents[0].skillName).toBe('skill-x');
    expect(agents[0].origin).toBe('project');
  });
});
