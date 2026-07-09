---
name: phase1-scaffold
description: 读分层设计文档，调用 project_intent 工具创建所有文件并写入 @intent。execute 的阶段一。
---

# Phase 1：文件骨架投射

## 前置阅读（必须）

先读取以下文档，作为 @intent 质量的评判依据：

- [GLOSSARY.md](./GLOSSARY.md) — @intent 核心原则（只说 import 看不出来的信息）
- [Tool.md](./intent_fmt/Tool.md) — Adapter工具类格式
- [UseCase.md](./intent_fmt/UseCase.md) — Application/UseCase 格式
- [EntityOrRepository.md](./intent_fmt/EntityOrRepository.md) — Data/Entity/Repository 格式

## 输入

读两份设计文档：
- `.cdd/02-arch-design.part-to-finish.md`（或 `03-layer-design.part-to-finish.md`）
- `.cdd/02-arch-design.part-to-later-on.md`（或 `03-layer-design.part-to-later-on.md`）

两份文档一起读，但角色不同：
- **part-to-finish** → 执行依据，这些文件要建骨架
- **part-to-later-on** → 上下文参考，知道哪些接口要预留

## 流程

### 1. 创建 part-to-finish 的文件

对 part-to-finish 文档中的每个条目，调用 `project_intent` 工具：

- `path` — 文件路径，按设计文档指定的层放入 `src/` 对应目录
- `intent` — 根据该文件在设计文档中的职责写 @intent，参考 intent_fmt/ 模板

### 2. 在已创建的文件中预留 later-on 接口签名

对照 part-to-later-on 文档，在 part-to-finish 已创建的文件中完成**接口预留**：

> 接口签名写进去，实现留空或返回 `throw new Error('not implemented')`

**示例**：

part-to-finish 要求实现 `TodoRepository.findById`，
part-to-later-on 标明 `create` / `update` 是 Phase 2。

则在 `TodoRepository` 接口中同时写入：

```typescript
// Phase 1（实现）
findById(id: string): Todo | null

// 预留（Phase 2 实现）
create(todo: Todo): Todo
update(id: string, partial: Partial<Todo>): Todo
```

> 注意：只预留**接口签名**，不建 later-on 的独立文件。
> 如果 later-on 涉及**全新模块**（不是已有文件的扩展），则不建文件、不留签名。

## 要点

- 本阶段不写实现逻辑（接口签名除外）
- later-on 的预留签名用注释标注 `// Phase 2 实现`
- 如果 part-to-finish 文档中的某个文件最终没有需要创建的内容，标注出来

## 完成

所有 part-to-finish 文件创建 + later-on 接口预留完毕后，确认文件结构与设计文档一致，然后进入 [PHASE2-TDD.md](PHASE2-TDD.md)。
