---
name: modify
description: 统一设计数据层、应用层、适配层的接口和交互，生成分层设计文档
---

## 前置

**必须读取**：
- `.cdd/01-requirements.md`（需求文档）

## 核心工具

**建议使用** `trace_dependency_chain` 辅助分析依赖关系。

## 流程
1. 用 trace_dependency_chain 追踪现有功能的完整调用链
2. 根据需求变更，标记需要修改的代码文件
3. 检查兼容性：修改接口时设计向下兼容方案（新增而非修改、保留旧方法等）
4. 输出：改动清单、影响范围、兼容方案、迁移步骤

## 约束
- 依赖倒置（DIP）,严格分层架构,外层可以依赖内层，内层绝不能依赖外层,同时不能跨层依赖,如果业务上有需求必须在中间层作为一个抽象接口。


### 3. 输出架构文档

Part to Finish = 这次需求的总需求，是必须交付的全部内容：
按 [part-to-finish.md](./part-to-finish.md) 输出 `.cdd/02-arch-design.part-to-finish.md`。

可以根据用户的需求得出其中的架构，询问用户是否需要割舍一些内容

Part to Later On = 设计阶段割舍的内容或实现过程中冒出来的“想法备忘录”，只是记下来，不承诺一定会做：
按 [part-to-later-on.md](./part-to-later-on.md) 输出 `.cdd/02-arch-design.part-to-later-on.md`。


