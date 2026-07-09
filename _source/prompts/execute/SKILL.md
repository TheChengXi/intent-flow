---
name: execute
description: 三分阶段生成代码：主会话投射文件骨架，隔离 TDD 逐文件实现，主会话集成验证。
---

# Execute

三分阶段执行。如果是修改已有功能而非新建，跳过 Phase 1。

| 阶段 | 执行位置 | 说明 |
|------|---------|------|
| 一：骨架投射 | **主会话** | 读设计文档，直接调 `project_intent` 建文件树 |
| 二：TDD 循环 | **子进程** | 逐文件隔离执行，防止测试泄露 |
| 三：集成验证 | **主会话** | 跨模块集成测试 + 重构收尾 |

---

## 阶段一：文件骨架投射（主会话）

## 前置阅读（必须）

先读取以下文档，作为 @intent 质量的评判依据：

- [GLOSSARY.md](./GLOSSARY.md) — @intent 核心原则（只说 import 看不出来的信息）
- [Tool.md](./intent_fmt/Tool.md) — Adapter工具类格式
- [UseCase.md](./intent_fmt/UseCase.md) — Application/UseCase 格式
- [EntityOrRepository.md](./intent_fmt/EntityOrRepository.md) — Data/Entity或者Repository的格式

读两份设计文档：
- `.cdd/02-arch-design.part-to-finish.md`
- `.cdd/02-arch-design.part-to-later-on.md`

对 part-to-finish 文档中的每个条目，直接调用 `project_intent` 工具创建文件骨架：

- `path` — 文件路径，按设计文档指定的层放入 `src/` 对应目录
- `intent` — 根据该文件在设计文档中的职责写 @intent

同时在已创建的文件中预留 part-to-later-on 的接口签名（实现留空或 `throw new Error('not implemented')`）。

> 注意：只预留接口签名，不建 later-on 的独立文件。

完成后确认文件结构与设计文档一致。

---

## 阶段二：TDD 循环（子进程隔离执行）

核心原则：**test-writer 和 code-writer 上下文隔离**——code-writer 看不到测试断言，防止"恰好通过测试"。

按文件顺序（自底向上，按依赖方向）逐文件执行。对**每个文件**依次调用：

### 第 1 步
调 `spawn_agent` — `agent: "test-writer"`，task 指定文件路径。写测试到磁盘，返回接口签名列表。

### 第 2 步
拿上一步的接口签名，调 `spawn_agent` — `agent: "code-writer"`，task 指定文件路径。写实现，跑测试确认全绿。

### 第 3 步
拿上一步结果，调 `spawn_agent` — `agent: "reviewer"`，task 指定文件路径。先跑测试，再审查代码。返回 `PASS` 则完成，返回 findings 则调 `code-writer` 修复后重审（最多 3 次）。

---

## 阶段三：集成验证（主会话）

所有文件 TDD 完成后，直接在主会话中执行：

1. **写集成测试** — 不 mock，用真实实现串联多个模块，每个核心通路 1–2 个测试
2. **跑全量测试** — 单元测试 + 集成测试 → 全绿
3. **重构** — 检查重复代码、过长函数、职责模糊、基本类型偏执。每步重构后跑测试
4. **端到端验证** — 如果有 CLI、MCP 工具或 API，跑一遍确认整个流程走通
