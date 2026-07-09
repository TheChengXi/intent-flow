---
name: phase2-tdd
description: 逐文件 TDD：先写测试（RED），再填充实现（GREEN），后加 @contract/@step/@boundary。
---

# Phase 2：TDD 逐文件循环

## 前置阅读

先读注释规范的[ANNOTATIONS.md](ANNOTATIONS.md)。

## 输入

Phase 1 创建的所有文件。

## 流程

### 准备工作

- 检查项目是否已有测试框架。没有就按技术栈安装一个（jest/vitest/pytest/go test/…）。
- 确保 `test` 脚本可用。
- 约定测试文件后缀：`*.test.ts` 或 `*_test.go` 等，按语言惯例。

### 逐文件 TDD 循环

**文件顺序**：自底向上，按依赖方向。

1. 最底层（无内部依赖）→ 2. 中间层（依赖底层接口）→ 3. 最顶层（依赖中间层）

**对每个文件**：

1. **读 @intent** — 知道该文件对外承诺什么行为。职责模糊时回设计文档澄清。
2. **写测试文件** — 在相同目录创建 `<文件名>.test.<扩展名>`。只测公开接口，覆盖 @intent 描述的行为。
3. **RED** — 跑测试。此时实现不存在或不完整，测试失败。
4. **写实现** — 写让当前测试通过的最少代码。不要超前实现未测试的功能。
5. **GREEN** — 跑测试，全绿通过。
6. **加标注** — @contract @step @boundary
### 测试原则

- 测行为（"结账后订单状态为 confirmed"），不测实现细节（"调用了 paymentService.process"）
- 用公开接口，不测私有方法
- 一个测试一个关注点
- 只在系统边界 mock（外部 API、文件系统、数据库）——**不 mock 自己的代码**

## 完成条件

- 所有输入文件经历 RED→GREEN 循环
- 测试套件全绿
- 每文件标注 @intent（Phase 1）+ @contract/@step/@boundary（本阶段）

完成后进入 [PHASE3-INTEGRATE.md](PHASE3-INTEGRATE.md)。
