---
name: phase2-implement
description: 对 Phase 1 创建的文件填充实现代码，标注 @contract/@step/@boundary。execute 的阶段二。
---

# Phase 2：实现填充

## 前置阅读

先读本目录的 [ANNOTATIONS.md](ANNOTATIONS.md)，了解 @contract、@step、@boundary 的规范。

## 输入

Phase 1 创建的所有文件。逐个读取文件的 @intent 了解职责，然后填充实现。

## 流程

自底向上，按以下顺序逐个文件填充：

1. **数据层实体**（最底层，无内部依赖）
2. **数据层仓库接口实现**
3. **应用层用例**（依赖仓库接口）
4. **适配层**（依赖用例）

### 对每个文件

1. **读骨架** — 读文件现有的 @intent 和方法签名
2. **写实现** — 填充方法体
3. **加注释** — 对公开方法标注 @contract → @step → @boundary
4. **不动 @intent** — @intent 已在 Phase 1 写入，不修改。如果实现时发现职责边界不对，先调整设计文档再回来改

## 要点

- 自底向上的顺序保证了实现每个文件时，它依赖的低层已经完成
- 不要一次实现过多文件——每个文件完成后确认符合设计约定再继续下一个
- 简单 getter/setter 不需要标注
