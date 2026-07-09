---
name: new-feature
description: 按三层架构设计系统架构，确定模块划分和层间关系。
---

## 前置

- **新项目**：读取 `.cdd/01-requirements.md`
- **已有项目**：读取 `.cdd/01-requirements.md`，并从已有入口文件开始分析

## 核心工具

- 可选使用 `trace_dependency_chain` 分析新模块内部依赖或集成点,

## 流程

### 1. 定位核心能力链

对每个核心能力，用 `trace_dependency_chain` 追踪其代码路径：

- 新项目：从预期入口文件开始
- 已有项目：从现有入口开始，覆盖 core-requirement 中识别的能力

## 约束
- 依赖倒置（DIP）,严格分层架构,外层可以依赖内层，内层绝不能依赖外层,同时不能跨层依赖,如果业务上有需求必须在中间层作为一个抽象接口。


### 2. 做架构决策

对每个核心能力，确定：

| 决策项 | 说明 |
|--------|------|
| **放哪层** | adapter / application / data |
| **新模块还是合入** | 独立模块还是加入已有模块 |
| **依赖谁** | 确保依赖方向符合三层约束 |
| **对外接口** | 暴露给其他模块的能力边界 |

### 3. 输出架构文档

Part to Finish = 这次需求的总需求，是必须交付的全部内容：
按 [part-to-finish.md](./part-to-finish.md) 输出 `.cdd/02-arch-design.part-to-finish.md`。

可以根据用户的需求得出其中的架构，询问用户是否需要割舍一些内容

Part to Later On = 设计阶段割舍的内容或实现过程中冒出来的“想法备忘录”，只是记下来，不承诺一定会做：
按 [part-to-later-on.md](./part-to-later-on.md) 输出 `.cdd/02-arch-design.part-to-later-on.md`。



