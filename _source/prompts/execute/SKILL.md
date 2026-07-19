---
name: execute
description: 三分阶段：先投射 @intent（规格PRD）→ TDD 向规格对齐 → 集成验证
---

# Execute

以下规则具有最高优先级。

@intent 是写在每个文件头顶的交付规格（PRD），实现向规格对齐。

三分阶段执行。Phase 2 期间不修改 @intent。

| 阶段 | 位置 | 产出 |
|------|------|------|
| 一：@intent 投射 | **主会话** | 每个文件头顶写入 @intent（新增创建 + 已有更新） |
| 二：TDD 循环 | **子进程** | 逐文件实现，向 Phase 1 的 @intent 对齐 |
| 三：集成验证 | **主会话** | 集成测试 + 重构，规格偏离时同步 @intent |

---

## 阶段一：@intent 投射（主会话，唯一改 @intent 的窗口）

### 前置阅读（必须）

1. 读取 [GLOSSARY.md](./GLOSSARY.md) 作为 @intent 质量的评判依据
2. 读取设计文档（`.cdd/02-arch-design.*.md`），识别每个条目的类型：
   - **已有文件** — 设计文档指定修改其职责/行为
   - **新增文件** — 设计文档指定新建

### 投射动作

#### 已有文件：更新 @intent

设计文档指定修改的已有文件，先更新其 @intent（规格先变，实现后跟）：

```
project_intent(
  path: "src/.../SomeFile.ts",
  intent: "更新后的职责描述，反映新功能对该文件的影响",
  force: true
)
```

#### 新增文件：创建 @intent

设计文档指定新建的文件，直接创建：

```
project_intent(
  path: "src/.../NewFile.ts",
  intent: "根据设计文档写 @intent（职责 + 边界 + 验收条件）"
)
```

同时在新建文件中预留 part-to-later-on 的接口签名（实现留空或 `throw new Error('not implemented')`）。

> 只预留接口签名，不建 later-on 的独立文件。

**完成标志**：所有涉及文件（已有+新增）头顶的 @intent 构成完整的规格集合，与设计文档一致。

---

## 阶段二：TDD 循环（子进程隔离执行）

核心原则：**test-writer 和 code-writer 上下文隔离**——code-writer 看不到测试断言，防止"恰好通过测试"。

按文件顺序（自底向上，按依赖方向）逐文件执行。每轮针对一个文件。

### 第 1 步：写测试

调 `spawn_agent` — `agent: "test-writer"`，task 指定文件路径。写测试到磁盘，返回接口签名列表。

### 第 2 步：写实现

拿上一步的接口签名，调 `spawn_agent` — `agent: "code-writer"`，task 指定文件路径。写实现，跑测试确认全绿。

实现向该文件头顶的 @intent（Phase 1 设定的规格）对齐。

### 第 3 步：审查

拿上一步结果，调 `spawn_agent` — `agent: "reviewer"`，task 指定文件路径。先跑测试，再审查代码是否满足 @intent 规格。

返回 `PASS` → 该文件完成。
返回 `FAIL` + findings → 调 `code-writer` 修复后重审（最多 3 次）。

**完成标志**：代码 + 测试全绿 + 实现满足 @intent 规格。

---

## 阶段三：集成验证（主会话）

所有文件 TDD 完成后，直接在主会话中执行：

1. **集成测试** — 不 mock，用真实实现串联多个模块，每个核心通路 1–2 个测试
2. **全量测试** — 单元测试 + 集成测试 → 全绿
3. **重构** — 重复代码、过长函数、职责模糊、基本类型偏执。每步重构后跑测试
4. **端到端验证** — CLI、MCP 工具或 API 跑通

重构改变文件职责时 → 调 `project_intent force:true` 同步该文件 @intent。

集成测试失败排查时，如发现是 @intent（规格）与实际需求不匹配而非代码 bug → 先更新 @intent，再改实现。
