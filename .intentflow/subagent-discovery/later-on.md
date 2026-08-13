# 后续想法备忘：subagent-discovery

> 设计阶段识别但**此时不做**的事项，以及未来可能的演进方向。只记录想法，不做任何设计预留——需要时直接实现。

## 想法列表

- **L01**：发现结果缓存与热重载
  - 现状：`discoverAll` 每次调用实时扫描文件系统（全局 + 项目级两个根目录）；当前目录规模小，I/O 可接受
  - 何时做：sub-skill 数量增长（>50 个）或 agent_chat 高频调用（>1 次/秒）时
  - 备注：`IAgentRepository` 已预留 `reload()` 注释；届时缓存 + 失效机制（文件 mtime 或显式 reload 命令）一并设计

- **L02**：与 pi 项目信任机制联动
  - 现状：pi 仅在项目受信任时加载项目级 skills；本仓库扫描是自实现文件系统读取，不受信任机制约束——extension 运行在用户自己的项目时无风险，但理论上会扫描并执行任意目录的 SUB-SKILL.md system prompt
  - 何时做：extension 被用于多项目/多租户场景，或安全评审提出要求时
  - 备注：可能的改动范围——扫描前校验项目信任状态（pi 是否有公开 API 待查）

- **L03**：monorepo 多包场景的项目级目录策略细化
  - 现状：收集 cwd 到 git root 之间所有存在的 `.pi/skills`；monorepo 中根与子包都有 `.pi/skills` 时，同名 agent 会被「更靠近 cwd 的目录」覆盖（后扫先覆盖）——当前语义未验证是否符合预期
  - 何时做：实际出现 monorepo 多级 `.pi/skills` 冲突时
  - 备注：届时需明确「最近目录优先」还是「根目录优先」的规则

- **L04**：`project_agent` 枚举值的潜在用途
  - 现状：`AgentSource` 中 `'project_agent'` 从未被使用；本次新增 `origin` 字段后，`source` 与 `origin` 正交，该枚举仍无消费者
  - 何时做：若未来支持项目级 user agents 目录（如 `.pi/agents/*.md`）时，`project_agent` 可作为其 source 值
  - 备注：本次明确不复用它标记项目级 sub-skill（见 design.md 决策1）

- **L05**：name 含 `/` 的解析边界
  - 现状：`skill/name` 拼接匹配假设 frontmatter `name` 不含 `/`；若出现含斜杠的 name，理论上可能与拼接串误配
  - 何时做：实际出现含 `/` 的 agent 名时
  - 备注：届时可改为「先尝试 `skillName/name` 整体匹配，再按最后一个 `/` 拆分」或显式拒绝

## 与当前设计的关系（轻量提示）

- L01 会扩展 `IAgentRepository` 接口（reload），但当前接口无需提前预留，届时直接加方法即可。
- L02/L03 影响的是 `resolveProjectSkillsDirs()` 的解析策略，当前实现保持简单（向上收集全部），未来改造时替换该方法内部逻辑即可，外部接口不变。
- L04 若实现，`AgentSource` 类型已就绪，无需改动实体。
