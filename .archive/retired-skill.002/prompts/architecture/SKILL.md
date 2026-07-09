---
name: architecture
description: 按三层架构设计系统架构，确定模块划分和层间关系。Use when 用户使用 /architecture 命令、或完成核心提取后想要设计架构。
---

# Architecture Design

按照 （adapter → application → data）设计系统架构，产出模块划分和层间依赖关系。

```
适配层（Adapter Layer）   ← 输入/输出适配器、DTO
    ↓ 依赖（严格单向）
应用层（Application Layer） ← 用例、业务规则、编排
    ↓ 依赖（严格单向）
数据层（Data Layer）     ← 实体、仓库接口、数据服务接口
```

## 前置

- **新项目**：读取 `.cdd/01-requirements.md`
- **已有项目**：读取 `.cdd/01-requirements.md`，并从已有入口文件开始分析

## 核心工具

**必须使用** `trace_dependency_chain` 分析能力链。

## 流程

### 1. 定位核心能力链

对每个核心能力，用 `trace_dependency_chain` 追踪其代码路径：

- 新项目：从预期入口文件开始
- 已有项目：从现有入口开始，覆盖 core-requirement 中识别的能力

### 2. 做架构决策

对每个核心能力，确定：

| 决策项 | 说明 |
|--------|------|
| **放哪层** | adapter / application / data |
| **新模块还是合入** | 独立模块还是加入已有模块 |
| **依赖谁** | 确保依赖方向符合三层约束 |
| **对外接口** | 暴露给其他模块的能力边界 |

### 3. 输出两份架构文档

**Part to Finish** — 当前必须完成的模块划分和最小依赖链：
按 [part-to-finish.md](./part-to-finish.md) 输出 `.cdd/02-arch-design.part-to-finish.md`。

**Part to Later On** — 后续要扩展的模块和接入条件：
按 [part-to-later-on.md](./part-to-later-on.md) 输出 `.cdd/02-arch-design.part-to-later-on.md`。

两份文档合在一起就是完整的架构设计视图。

