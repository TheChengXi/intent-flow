---
name: layer-design
description: 统一设计数据层、应用层、适配层的接口和交互，生成分层设计文档。Use when 用户使用 /layer-design 命令、或完成架构设计后想要设计各层细节。
---

# Layer Design

基于架构设计（architecture 的输出），统一设计三层（adapter → application → data）的接口、实体、交互。

## 前置

**必须读取**：
- `.cdd/01-requirements.md`（需求文档）

## 核心工具

**建议使用** `trace_dependency_chain` 辅助分析依赖关系，如果是从零开始的项目则不使用

## 流程

### 1. 识别数据实体

从需求文档中提取核心业务实体和字段：

- 哪些名词是核心概念？
- 哪些实体需要持久化？
- 实体间的关系是什么？

输出：实体定义 + 仓库接口签名。

### 2. 识别应用用例

从需求文档中提取用例和业务规则：

- 每个用户操作对应一个用例
- 每个用例封装一个完整的业务流程
- 用例编排数据层的多个操作

输出：用例定义 + 业务规则说明。

### 3. 识别适配器

从需求文档中提取输入/输出适配器：

- 输入适配器（UI、API、CLI、Chat 等）
- 输出适配器（数据库实现、外部 API 调用等）
- DTO 和格式转换

输出：适配器类型 + 接口定义。

### 4. 验证一致性

确保三层之间的接口能正确对接：

- 适配器调用的用例是否都存在？
- 用例依赖的仓库接口是否都存在？
- 数据流向是否清晰？（外部请求 → 适配层 → 应用层 → 数据层）

## 输出两份分层设计文档

**Part to Finish** — 当前必须实现的接口、实体和用例：
按 [part-to-finish.md](./part-to-finish.md) 输出 `.cdd/03-layer-design.part-to-finish.md`。

**Part to Later On** — 后续扩展的接口和实体：
按 [part-to-later-on.md](./part-to-later-on.md) 输出 `.cdd/03-layer-design.part-to-later-on.md`。

两份文档合在一起就是完整的分层设计视图。

