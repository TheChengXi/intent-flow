# 现在必须完成 — 分层接口设计

## 数据层（Data Layer）

### 实体（Phase 1）

#### AgentDefinition
- **字段**：
  - `name: string` — Agent 名称（Phase 1）
  - `description: string` — 描述（Phase 1）
  - `tools?: string[]` — 工具白名单，无则为所有默认工具（Phase 1）
  - `model?: string` — 模型覆盖，无则使用主线模型（Phase 1）
  - `systemPrompt: string` — 系统提示词（frontmatter body + include/ 知识库合并）（Phase 1）
  - `source: 'sub_skill' | 'user_agent' | 'project_agent'` — 来源类型（Phase 1）
  - `skillName?: string` — 所属 skill 名（sub-skill 发现时有效）（Phase 1）
  - `filePath: string` — SUB-SKILL.md 或 .md 文件路径（Phase 1）
  - `includeErrors?: string[]` — 知识库加载错误（Phase 1）
- **关系**：被 AgentRunResult 引用（一个定义可多次运行）
- **验证规则**：name 必填且唯一（同名去重时后覆盖前）

#### AgentRunResult
- **字段**：
  - `agent: string` — Agent 名称（Phase 1）
  - `exitCode: number` — 子进程退出码（Phase 1）
  - `output: string` — 子进程输出文本（Phase 1）
  - `error?: string` — 错误信息（Phase 1）
  - `usage: AgentUsage` — 运行统计（Phase 1）
  - `model?: string` — 实际使用的模型（Phase 1）
  - `durationMs: number` — 运行耗时（Phase 1）
- **关系**：引用 AgentDefinition.name
- **验证规则**：output 截断到 50KB

#### AgentUsage
- **字段**：
  - `input: number` — 输入 token 数（Phase 1）
  - `output: number` — 输出 token 数（Phase 1）
  - `cost: number` — 花费（美元）（Phase 1）
  - `turns: number` — 交互轮数（Phase 1）
- **关系**：嵌入在 AgentRunResult 中
- **验证规则**：非负整数/浮点

### 仓库接口（Phase 1）

#### IAgentRepository

```
✅ Phase 1 实现：
  - discoverAll(scope: AgentScope): Promise<AgentDefinition[]>
      按 scope 扫描文件系统发现 agent（sub-skill 优先 → agents/*.md 回退）
  - findByName(name: string, scope: AgentScope): Promise<AgentDefinition | null>
      按名称查找单个 agent

🔲 预留（Phase 2+ 实现）：
  - reload(): Promise<void>
      强制刷新缓存（目前每次调用实时扫描，未来可加缓存层）
```

> IAgentRepository 接口定义在 `src/data/repositories/IAgentRepository.ts`
> 实现放在 `src/adapter/pi/agents/SubSkillRepository.ts`（pi 特有，不污染通用数据层）

#### ISubProcessRunner

```
✅ Phase 1 实现：
  - run(params: SubProcessRunParams): Promise<AgentRunResult>
      在隔离子进程中运行 agent，返回 structured result

🔲 预留（Phase 2+ 实现）：
  - runParallel(params: SubProcessParallelParams): Promise<AgentRunResult[]>
      并发运行多个 agent，限制最大并发数
  - runChain(params: SubProcessChainParams): Promise<AgentRunResult[]>
      链式运行，上一步输出作为下一步 {previous} 占位符
```

> ISubProcessRunner 接口定义在 `src/data/repositories/ISubProcessRunner.ts`
> 实现放在 `src/adapter/pi/agents/SubProcessRunner.ts`

---

## 应用层（Application Layer）

### 用例（Phase 1）

#### DiscoverAgentsUseCase
- **职责**：编排 IAgentRepository 发现 agent，返回结构化结果
- **前置条件**：文件系统可读
- **后置条件**：返回 AgentDefinition[] + 错误列表
- **依赖仓库**：
  - `IAgentRepository.discoverAll()`（Phase 1）
- **依赖哪些预留接口**：无

#### SpawnAgentUseCase
- **职责**：接收 agent 名称 + 任务，查找定义，在子进程运行
- **前置条件**：agent 名称对应已发现的 AgentDefinition
- **后置条件**：子进程运行结束，返回 AgentRunResult
- **依赖仓库**：
  - `IAgentRepository.findByName()`（Phase 1）
  - `ISubProcessRunner.run()`（Phase 1）
- **依赖哪些预留接口**：无

---

## 适配层（Adapter Layer）

### 输入适配器（Phase 1）

#### Pi Extension — spawn_agent 工具
- **入口**：`src/adapter/pi/tools/SpawnAgentTool.ts`
  - pi 注册名为 `spawn_agent`
  - `promptSnippet`: "Spawn isolated sub-agents for delegated work"
  - `promptGuidelines`: 参考 agent-spawn.ts 的原始描述
- **调用的用例**：`SpawnAgentUseCase`
- **输入参数**：`agent: string, task: string, context?: string, model?: string, timeoutMs?: number`
- **输出**：`AgentRunResult` 结构（exitCode, output, usage, duration）

#### Pi Extension — subagent 工具（备用入口）
- **入口**：`src/adapter/pi/tools/SubagentTool.ts`
  - pi 注册名为 `subagent`，支持单/并行/链式
  - 包装 pi 官方 subagent 的三种模式
- **调用的用例**：`SpawnAgentUseCase` + `IAgentRepository`
- **输入参数**：`agent + task`（单次）/ `tasks[]`（并行）/ `chain[]`（链式）
- **输出**：根据模式不同输出结构
- **Phase 1 范围**：仅实现单次模式，并行/链式预留接口签名

#### Pi 命令 — /sub-skill
- **入口**：`src/adapter/pi/extension.ts`
  - pi 注册名为 `sub-skill`
  - `/sub-skill` 查看全部，`/sub-skill <skill>` 只看该 skill 下的
- **调用的用例**：`DiscoverAgentsUseCase`
- **输出**：按 skill 分组的 agent 列表文本

#### 基础 infra — extension 入口
- **入口**：`src/adapter/pi/extension.ts`
  - 默认导出函数 `(pi: ExtensionAPI) => void`
  - 在 `session_start` 时初始化 agent 缓存
  - 注册 `spawn_agent` 工具
  - 注册 `subagent` 工具（单次模式）
  - 注册 `/sub-skill` 命令

### 输出适配器（Phase 1）

无传统输出适配器。子进程 spawn 由 `ISubProcessRunner` 封装，其实现 `SubProcessRunner.ts` 通过 `node:child_process.spawn()` 调用系统 pi 命令。
