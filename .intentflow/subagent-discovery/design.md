# 设计文档：subagent-discovery（sub-agent 发现修复）

## 0. 与需求文档的偏差（设计阶段新发现）

- **偏差1**：需求文档写「项目级内部多个同名时返回最后扫描到的（与 last-wins 语义一致）」— **影响**：`readdir` 目录顺序不可控，「最后扫描到的」不可预测、不可测。设计改为确定性规则：**匹配优先级 = 项目级 > 全局，同级内取发现列表第一个**。行为差异在真实场景几乎不可观察，但可写进单测。
- **偏差2**：需求文档说「如新增 `origin` 字段」— **影响**：确认采用，且发现 `AgentDefinition` 已有未使用的 `AgentSource` 枚举值 `'project_agent'`。**不复用**：`source` 语义是「发现方式」（sub-skill 扫描 / user agents 目录），`project_agent` 含义模糊（项目级 sub-skill？项目级 agents/*.md？），复用会污染语义。新增正交字段 `origin`，与 `source` 互补。
- **偏差3**：需求文档「收集所有存在的 `.pi/skills`」— **影响**：保持（与 pi 原生语义一致：cwd 及祖先目录），git root 判定用 `.git` 文件或目录（兼容 worktree 的 `.git` 文件形态）。
- **偏差4**（新发现）：`AgentRepositoryImpl` 目前**没有测试文件**，需求文档「仓库层单测」是纯新增；smoke 测试 `dicontainer.smoke.test.ts` 只断言 agents 为数组且 errors 为空，修复后（项目级可发现、目录缺失静默跳过）**不受影响**。

## 1. 模块清单

本次改动全部落在 data 层，application / adapter 零改动。

- **[AgentDefinition]**：data/entities — 职责：agent 实体，新增来源层级标识 `origin` — 依赖：无
- **[AgentRepositoryImpl]**：data/services/agent — 职责：多目录 sub-skill 发现（全局 + 项目级）、(skillName, name) 去重、findByName 名称解析（name + skill/name 别名、项目级优先）— 依赖：IAgentRepository、AgentDefinition、node:fs/promises、node:path、node:os
- **[AgentRepositoryImpl.test.ts]**（新增）：data/services/agent — 职责：仓库层单测（临时目录注入）— 依赖：vitest

## 2. 最小依赖链

```
[adapter] ListAgentsTool / AgentCommTools
    → [application] DiscoverAgentsUseCase / AgentRequestUseCase
        → [application] IAgentRepository（services/agentRepository.ts 类型透出）
            → [data] AgentRepositoryImpl（本次改动）
                → [data] AgentDefinition（+origin）
```

- 本次需求关键路径：`agent_chat 调用 → AgentRequestUseCase.findByName('sub_skill') → AgentRepositoryImpl.discoverAll（全局+项目级扫描）→ AgentDefinition[]`；`RpcProcessPool.spawnProcess` 复用同一 findByName，链路不变。
- **跨层依赖体检**：逐层确认无反向依赖——adapter → application → data 单向；application 经 `services/agentRepository.ts` 透出类型（不跨层 import data 实现）；`CoreDIContainer`（application）组装 `AgentRepositoryImpl`（data）为既有模式。**本次无跨层依赖，无附带修复项**。
- `CoreDIContainer` 中 `new AgentRepositoryImpl()` 无参构造保持不变——项目级路径解析在仓库内部完成（`process.cwd()` 向上查找）。

## 3. 测试策略

### AgentRepositoryImpl（隔离 TDD）
- **验证模式**：[隔离 TDD] — 理由：文件系统扫描行为需运行时验证（目录存在性、优先级、去重）
- **依赖注入点**：构造器注入 `AgentRepositoryImplOptions`——`skillsDir`（全局根）、`projectSkillsDirs`（显式项目级目录，注入时跳过向上查找）、`cwd`（向上查找起点，测试用）；测试用 `mkdtemp` 建真实临时目录树（**不 mock 文件系统**——仓库本身即 IO 边界，mock 内部协作者反而失真）
- **验证命令**：
  - `npx vitest run src/data/services/agent/AgentRepositoryImpl.test.ts` — 预期：全部通过
  - `npx vitest run` — 预期：全量通过（回归，smoke 测试兼容）
- **Mock 边界**：无 mock（真实临时目录）；application 层用例测试（AgentRequestUseCase.test.ts）沿用现有 mock 仓库方式，不受影响

### 端到端（手动，修复后本会话直接验证）
- 验证命令：调用 `list_agents` — 预期：`[execute]` 分组含 `test-writer`、`code-writer`
- 验证命令：调用 `agent_chat(agent="test-writer")` / `agent_chat(agent="tdd/test-writer")` — 预期：成功派发
- 验证命令：`agent_chat(agent="no-such-agent")` — 预期：`Agent not found`，不崩溃

### 单测用例清单（对应需求文档 7 项 + 1 项新增）

| # | 场景 | 断言 |
|---|------|------|
| 1 | 仅项目级目录有 sub-skill | discoverAll 返回，`origin === 'project'` |
| 2 | 全局 + 项目级同名同 skill | 只留一个，且 `origin === 'project'` |
| 3 | 两个 skill 下同名 agent | 都保留（(skillName, name) 去重） |
| 4 | findByName('test-writer') 多命中（不同 skill，一 project 一 global） | 返回 project 来源 |
| 5 | findByName('tdd/test-writer') | 命中 tdd skill 下 agent |
| 6 | findByName('no-such') | null |
| 7 | 目录不存在 | 空结果 + errors，不抛异常 |
| 8 | cwd 向上查找 + git root 截断 | 嵌套 cwd 找到祖先 `.pi/skills`；越过 git root 不再向上 |

## 4. 决策记录

- **决策1：新增 `origin` 字段，不复用 `source: 'project_agent'`**
  - 理由：`source` 表达「发现方式」，`project_agent` 枚举值从未被使用且语义模糊；`origin: 'global' | 'project'` 表达「目录层级」，与 source 正交，语义清晰。备选「复用 project_agent」被否：会让后来者混淆该项目级 sub-skill 与项目级 agents/*.md 的关系。
  - 影响：`AgentDefinition` 加 `origin?: AgentOrigin`（**可选**——user agents 扫描无层级概念，undefined 视为全局优先级，避免该路径被迫传值；现有构造处（如 AgentRequestUseCase.test.ts 的 makeAgent）不破坏）。
- **决策2：项目级目录解析放 AgentRepositoryImpl 内部，不新开模块**
  - 理由：逻辑小（向上探测 + git root 判定，约 20 行），唯一使用者是仓库；新开 util 模块反而增加文件数与检索成本。options 扩展 `projectSkillsDirs` / `cwd` 供测试注入，生产无参构造走 `process.cwd()`。
  - 影响：仓库构造函数签名扩展（向后兼容，现有 `new AgentRepositoryImpl()` 调用处不变）。
- **决策3：优先级依赖扫描顺序 + last-wins 去重，不额外排序**
  - 理由：扫描顺序固定为「全局 sub-skill 先入 → 项目级 sub-skill 后入 → user agents」（both 模式），deduplicate last-wins 自然实现「项目级覆盖全局、sub-skill 覆盖 user」。无需在 discoverAll 里做二次排序，最小改动。
  - 影响：`origin` 字段不参与 discoverAll 去重，只用于 findByName 多命中时的确定性选择。
- **决策4：findByName 匹配顺序「name 精确 → skill/name 拼接」，同级内取第一个**
  - 理由：name 精确匹配是主路径（现有行为）；`skillName/name` 拼接在去重后天然唯一（去重键即 (skillName, name)），回退匹配确定性最高。多命中按「project 优先，同级取发现列表第一个」（对需求文档偏差1的修正）。
  - 影响：`findByName` 实现从 `find` 改为「收集全部匹配 → 优先级选择」，行为向后兼容（单命中时结果不变）。

## 5. 改动点清单

**改动文件**：
1. `src/data/entities/AgentDefinition.ts` — 新增 `AgentOrigin` 类型 + `origin?: AgentOrigin` 字段
2. `src/data/services/agent/AgentRepositoryImpl.ts` —
   - options 扩展：`projectSkillsDirs?: string[]`、`cwd?: string`
   - 新增 `resolveProjectSkillsDirs()`（cwd 向上查找 `.pi/skills` 至 git root，收集所有存在的）
   - `scanAllSubSkills` 改造：接收多个根 + origin 标记；`parseAgentFile` / `scanSubSkillDir` 透传 origin
   - `deduplicate` 键改为 `${skillName ?? ''}::${name}`
   - `findByName`：name 精确（多命中 project 优先）→ `skillName/name` 拼接回退

**新增文件**：
3. `src/data/services/agent/AgentRepositoryImpl.test.ts` — 单测 8 项（mkdtemp 临时目录）

**application / adapter 层**：无改动（用例、工具、进程池、DI 容器均不感知）。
