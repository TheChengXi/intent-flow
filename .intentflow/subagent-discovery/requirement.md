# 需求文档：subagent-discovery（sub-agent 发现修复）

## 项目意图

修复 sub-agent 发现链路：让 `list_agents` / `agent_chat` 能从项目级 `.pi/skills`（并兼容全局 `~/.pi/agent/skills`）发现并解析 sub-agent，支持 `name` 与 `skill/name` 两种调用方式。

## 功能清单

1. **多目录发现**：sub-skill 扫描范围从「仅全局 `~/.pi/agent/skills`」扩展为「全局 + 项目级合并扫描」
2. **项目级目录定位**：从 cwd 向上查找 `.pi/skills`（直到 git root 或文件系统根）
3. **去重规则调整**：去重键从 `name` 改为 `(skillName, name)`，跨 skill 同名 agent 可共存
4. **路径式名称解析**：`agent_chat` / `findByName` 支持 `skill/name` 别名，裸名多命中时按「项目级 > 全局」优先级取一个

## 核心功能

### 核心功能1：多目录 sub-skill 发现
- **能力**：系统能够从全局 `~/.pi/agent/skills` 与项目级 `.pi/skills` 两个来源发现 `skills/<skill>/sub-skill/` 下的 SUB-SKILL.md，合并为 agent 列表，同名时项目级覆盖全局
- **业务价值**：`list_agents` 能列出工作区实际注册的 sub-agent（如 `execute` 分组下的 `test-writer`、`code-writer`），agent_chat 可调用

### 核心功能2：名称解析（name + skill/name 别名）
- **能力**：系统能够按 `name`（如 `test-writer`）精确解析 agent；精确匹配失败或无唯一命中时，按 `skillName/name`（如 `tdd/test-writer`）解析；裸名多命中时优先返回项目级来源
- **业务价值**：`agent_chat` 两种调用方式都可用，与 `list_agents` 的分组展示（`[skill]` 分组）自然对应

## 业务规则

### 扫描目录规则
- **场景**：`discoverAll(scope='sub_skill')` 被调用（list_agents、agent_chat 校验、warmUp 预热）
- **行为**：依次扫描全局 `~/.pi/agent/skills` → 项目级 `.pi/skills`（从 `process.cwd()` 向上查找，直到 git root；非 repo 时到文件系统根，收集所有存在的 `.pi/skills`）；每个根目录下按 `<skill>/sub-skill/` 递归查找 SUB-SKILL.md
- **异常处理**：目录不存在或不可读时静默跳过并计入 errors（沿用现有边界，不抛异常）

### 优先级与去重规则
- **场景**：全局与项目级存在同名 agent，或不同 skill 下存在同名 agent
- **行为**：去重键为 `(skillName, name)`——`tdd/test-writer` 与 `web/test-writer` 可共存；同一 `(skillName, name)` 内项目级覆盖全局（扫描顺序：全局先入、项目级后入，last-wins）
- **异常处理**：无（去重为确定性规则，不产生错误）

### 名称解析规则
- **场景**：`findByName(name, 'sub_skill')` 被调用（AgentRequestUseCase 校验、RpcProcessPool spawn）
- **行为**：先按 `name` 精确匹配；若多个命中，返回项目级来源的 agent（项目级内部多个同名时返回最后扫描到的，与 last-wins 语义一致）；`name` 精确匹配失败时，回退匹配 `skillName/name` 拼接串
- **异常处理**：无匹配 → 返回 null → 上层抛 `Agent not found: "<name>"`（沿用现有行为）

## 预设测试

> 从用户视角可执行的测试步骤，验证功能是否符合预期。

### 前置条件
- 工作区 `D:\w_dev\intent-flow\.pi\skills\execute\sub-skill\tdd\` 下存在 `test-writer`、`code-writer` 的 SUB-SKILL.md（已确认存在，frontmatter `name` 合法）
- pi extension 已加载（本会话即为验证环境）

### 测试步骤

1. **list_agents 列出工作区 sub-agent**
   **操作**：调用 `list_agents`
   **预期结果**：返回 `[execute]` 分组，包含 `test-writer` 与 `code-writer`（当前返回"当前没有可用的 sub-agent"）

2. **agent_chat 按 name 调用**
   **操作**：调用 `agent_chat(agent="test-writer", message="...")`
   **预期结果**：成功派发任务并返回结果（当前报 `Agent not found`）

3. **agent_chat 按 skill/name 调用**
   **操作**：调用 `agent_chat(agent="tdd/test-writer", message="...")`
   **预期结果**：成功派发任务并返回结果（当前报 `Agent not found`）

4. **不存在的 agent 报错清晰**
   **操作**：调用 `agent_chat(agent="no-such-agent", ...)`
   **预期结果**：报 `Agent not found: "no-such-agent"`，不崩溃

### 异常场景

- **全局目录不存在**：`~/.pi/agent/skills` 不存在时，发现结果不受影响（静默跳过）→ `list_agents` 仍能列出项目级 sub-agent
- **无 .pi/skills 的项目**：cwd 向上找不到任何 `.pi/skills` 时 → `list_agents` 返回"当前没有可用的 sub-agent"（不抛错），`agent_chat` 报 Agent not found

### 单元测试（仓库层，注入临时目录）

1. 仅项目级目录有 sub-skill → `discoverAll('sub_skill')` 返回它们
2. 全局 + 项目级同名（同 skillName）→ 只留一个，且为项目级来源
3. 两个 skill 下同名 agent → 都保留（(skillName, name) 去重生效）
4. `findByName('test-writer')` 多命中 → 返回项目级来源
5. `findByName('tdd/test-writer')` → 命中 tdd skill 下的 agent
6. `findByName('no-such')` → null
7. 目录不存在 → 返回空结果 + errors，不抛异常（回归现有行为）

## 边界收束

**此时必做**：
- AgentRepositoryImpl 多目录扫描（缺少则 list_agents 空、agent_chat 全挂，核心问题无法解决）
- 项目级目录定位（cwd 向上查找至 git root）
- (skillName, name) 去重 + 项目级优先（与路径式别名配套，否则语义不自洽）
- 路径式名称解析（用户已确认需要）
- 仓库层单测 + 端到端验证（用户已确认需要）

**此时不做**：
- 发现缓存/热重载 — 每次调用实时扫描，目录规模小（两个根目录、少量文件），I/O 可接受；接口已预留 `reload()` 给 Phase 2+
- 与 pi 项目信任机制联动 — pi 仅在项目受信任时加载项目级 skills；本项目扫描是自实现文件系统读取，不受信任机制约束。当前 extension 仅运行在用户自己的项目，风险可接受；若未来支持任意目录加载再评估
- user scope（`~/.pi/agent/agents/*.md`）— 本次不涉及，行为保持不变
- 缓存命令 / warmUp 预热逻辑 — 基于 discoverAll，修复后自动受益，无需改动

## 实现对齐

- **[多目录发现]**：`AgentRepositoryImpl` 增加项目级 skills 目录解析（从 `process.cwd()` 向上查找 `.pi/skills` 至 git root），`discoverAll` 按「全局先扫、项目级后扫」合并两个根目录的 `scanAllSubSkills` 结果，last-wins 去重自然实现项目级覆盖
- **[去重]**：`deduplicate` 的 Map 键从 `agent.name` 改为 `${skillName}::${name}`（skillName 为 undefined 时退化为仅 name）
- **[名称解析]**：`findByName` 先收集全部 `name` 精确匹配，多个命中时返回项目级来源（需在 AgentDefinition 上区分来源层级，如新增 `origin: 'global' | 'project'` 字段，或按扫描顺序取后入者）；无命中时回退匹配 `skillName/name` 拼接
- **实现细节**：
  - 输入来源：全局目录常量 `~/.pi/agent/skills`（现有）+ 项目级目录动态解析（cwd 向上查找，git root 判定为存在 `.git` 文件/目录）；`CoreDIContainer` 中 `new AgentRepositoryImpl()` 无参构造保持，路径解析在仓库内部完成，或经 options 注入便于测试
  - 数据流转：AgentDefinition 增加来源层级标识（供优先级判定），其余字段（name/description/tools/model/systemPrompt/source/skillName/filePath）不变；`application` 层端口与用例（DiscoverAgentsUseCase、AgentRequestUseCase）零改动
  - 失败处理：目录不存在/不可读静默跳过计入 errors（沿用现有）；解析失败不抛异常
  - 边界条件：非 repo 目录向上查到文件系统根；`process.cwd()` 即项目根时只扫一层；同名去重不区分大小写与否沿用现有行为（name 精确匹配）

与预设测试的关系：扫描目录规则 ↔ 测试 1、2、7；优先级与去重 ↔ 测试 2、3、4；路径式解析 ↔ 测试 5、6；端到端 ↔ 测试步骤 1-4。
