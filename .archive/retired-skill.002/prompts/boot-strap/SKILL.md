---
name: boot-strap
description: 用 trace_dependency_chain 读取项目能力树，逐层审查 @intent 质量。Use when 需要确保整个代码库的 @intent 描述连贯、规范、反映实际职责。
---

# Boot-strap

利用 MCP 工具读取能力树，修正项目架构意图。本质是 **文档驱动开发**。

## 流程

### 1. 加载标准

先读取以下文档，作为 @intent 质量的评判依据：

- [GLOSSARY.md](./GLOSSARY.md) — @intent 核心原则（只说 import 看不出来的信息）
- [Tool.md](./intent_fmt/Tool.md) — Adapter工具类格式
- [UseCase.md](./intent_fmt/UseCase.md) — Application/UseCase 格式
- [EntityOrRepository.md](./intent_fmt/EntityOrRepository.md) — Data/Entity/Repository 格式

### 2. 抓取能力树

对项目的关键入口文件逐一调用 `trace_dependency_chain`：

路口文件按习惯放在适配层，可以检查适配层内部的README.md(如果有)

输出已按架构层（adapter → application → data）和同层/跨层分组，直接用作扫描地图。

### 3. 逐层审查

按 **data → application → adapter** 顺序，层层推进。对每个文件逐条判定：

- **缺少 @intent** — 完全没写，或只有文件名占位
- **只描述实现** — 如"读取文件并解析 import"，不如直接看代码
- **描述依赖** — 如"依赖 IFileRepository"，import 已表达
- **与能力树不符** — `trace_dependency_chain` 看到的依赖关系与 intent 说不一致
- **与同层同类不一致** — 同文件夹同类文件的 intent 详略风格相差太大

### 4. 修正

对不合格的，手动修改。

修正完后对同一入口再次运行 `trace_dependency_chain` 确认效果。迭代直到整棵能力树的 @intent 都连贯、精准、符合标准。

## 原则

- **不改代码，只改注释。** 如果发现代码和 @intent 不符，记下来留给 execute 修，不要在 boot-strap 里修代码。
- **同一层的同类文件标准一致。** Tools 的 intent 详略程度应该相近，UseCase 也是。
- **超过能力不够改成废话。** 如果某个文件职责太杂写不清楚边界，那是需要重构的信号，不要用长句包装，直接停下来提醒用户。
