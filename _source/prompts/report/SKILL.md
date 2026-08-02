---
name: report
description: 执行完成后关账。聚合需求、设计与执行产出（隔离 TDD 执行时读取 logs/ 子 agent 工作报告），输出关账报告，记录偏差、经验与后续待办，生成能力打包并提交 Git。
---

# 关账报告

以下规则具有最高优先级。

五步执行：提取 → 生成 → 写入 → 打包 → 提交。

---

## 1. 读取子 agent 工作报告

仅当 `.cdd/<feature-name>/logs/` 存在时读取（隔离 TDD 模式执行产生；直接模式执行不产生）：

- `test-report.md`：测试覆盖、接口签名
- `code-report.md`：实现决策、疑虑、卡点
- `review-report.md`：审查结论、findings

读取后将各报告的内容映射到生成步骤的对应节。

logs/ 不存在（直接模式执行）时跳过本节，第 2~7 节基于 git diff、@intent 与对话上下文生成，对应节无内容时写"无"。

## 2. 纳入后续待办

如果 `later-on.md` 在对话上下文中存在 → 在文档中引用绝对地址

## 3. 生成报告

输出七节结构化内容：

```
# <feature-name> 关账报告

## 1. 项目概览
一句话说明这个 feature 做什么。

## 2. 计划 vs 实际
- 计划功能清单 vs 实际完成状态
- 每项标注：✅ 完成 / 🔸 部分 / ❌ 未做 + 原因

## 3. 关键决策
记录执行途中与原始设计不符的决策及理由。

## 4. 经验记录
- 有效做法 — 可复用到后续 feature
- 踩坑 — 下次应避免
- 工具反馈 — 当前 skill / 工具链的不足或建议

## 5. 后续待办
- 立即跟进（从执行阶段未完成项中提取）
- 长期备忘（从 later-on.md 引用，标注原文路径）

## 6. 开发工作流反馈
对 requirement → design → execute → report 流程本身的反馈：流程断点、skill 缺失、工具链瓶颈。

与第 4 节区别：第 4 节记录在具体 feature 执行中发现的工具用法和技巧，本节记录工作流层面的结构性改进建议。

## 7. 结论
- 当前状态：可发布 / 需补测 / 搁置
- 建议下一步
```

每节至少一句。无内容时写"无"。

## 4. 写入文件

写入 `.cdd/<feature-name>/report.md`。

## 5. 生成能力打包

代码执行后，所有变更文件均已带有 `@intent`。

- 收集本次 feature 涉及的全部文件
- 每个文件记录**在这 feature 中的具体改动**（而非 @intent 原文——@intent 可通过 `rg @intent <path>` 原地读取）
- 按**功能内聚**分组（跨层关联），而非按目录层级分组（按层分组是目录结构的投影，零信息增量）
- 写入 `.cdd/packages/<feature-name>.yml`

### 包格式

```yaml
packageName: <feature-name>
summary: |
  包职责、对外依赖、入口建议、当前状态。

files:
  - path: <相对项目根目录的路径>
    change: <这个文件在这个 feature 中的具体改动>

groups:
  - name: 分组名
    summary: 功能内聚描述——为什么这些文件在一个组，维护者通过这个分组能理解什么能力关联
    files:
      - <文件名>
```

**完成标志**：`.cdd/packages/<feature-name>.yml` 存在且可读。

### 分组原则

- ✅ 按功能内聚分组：跨层聚合功能强相关的文件，让维护者理解「这些文件共同构成了什么能力」
- ✅ 分组是对能力关联的语义注释，不是目录结构的重复
- 一个组内的文件可能分布在 data、application、adapter 不同层——这正是分组的信息增量

## 6. 提交 Git

在写入完成后执行：

1. `git add .` — 纳入全部变更（代码 + 报告 + 能力打包）
2. `git commit -m "<scope>: <feature-name> 关账"` — 提交信息格式：
   - 新 feature → `feat(<feature-name>): 关账`
   - 修复/修改 → `fix(<feature-name>): 关账`

不推送。不处理冲突。

**完成标志**：commit 成功，提交信息包含 feature-name。
