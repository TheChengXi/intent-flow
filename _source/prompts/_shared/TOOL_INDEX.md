# 工具归属索引

每项工具（MCP Tool/CLI 命令）对应其所属技能和设计用途。AI 应在此表确认工具调用属于其被设计的场景，发现误用应质疑。

## 工具列表

| 工具名 | 适配层 | 所属技能 | 用途 | 不适合的场景 | 备注 |
|---|---|---|---|---|---|
| `project_intent` | MCP + CLI | `execute` Phase 1 | 创建新文件并写入 @intent 骨架 | 修改已有文件的 @intent；修正注释质量 | force=true 时全量覆盖文件内容——用于重跑骨架投射，不可做局部编辑 |
| `trace_dependency_chain` | MCP + CLI | `architecture` / `boot-strap` / `layer-design` | 分析入口文件依赖链及 @intent 语义（simple/normal/complex 三层深度） | 已知道路——能力列表的输出本身就是结论，不需要再手工 grep 原文"验证" | 输出按同层/跨层分组，每文件带 @intent 原文，可直接作审查依据 |
| `check_file_size` | MCP + CLI | 通用（所有技能） | 检查文件及其依赖树的行数，识别需要重构的文件 | — | 不修改文件，只读分析 |
| `search_type_definition` | MCP + CLI | 通用（所有技能） | 在文件中搜索类型定义（interface / type / class / enum） | — | 返回 null 时表示不存在，不作假设 |

## 技能与工具映射

| 技能 | 使用工具 | 用途阶段 |
|---|---|---|
| `structure` | 无 | 纯文档收集，不调用 MCP 工具 |
| `core-requirement-extraction` | 无 | 纯文档分析，不调用 MCP 工具 |
| `architecture` | `trace_dependency_chain` | 分析现有系统的能力链，辅助架构设计 |
| `layer-design` | `trace_dependency_chain`（建议使用） | 分析依赖关系辅助分层设计；从零开始的项目则不使用 |
| `execute` | `project_intent` | Phase 1 中为每个新文件创建骨架并写入 @intent |
| `boot-strap` | `trace_dependency_chain` | 扫描能力树，逐层审查 @intent 质量；修正走手动编辑|

## 原则

- **一个工具只属于一个技能的"核心流程"**，其他技能引用时需验证是否匹配工具的原始设计。
- **工具的适用场景由 `_shared/tools/<tool>.md` 定义**，技能引用前应先读取该文档确认不偏离。
- 工具 description（MCP 注册字段）是摘要行，不足以判断适用场景——完整文档在 `_shared/tools/`。
