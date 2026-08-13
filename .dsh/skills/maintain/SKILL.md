---
name: maintain
description: 把累积的迭代事实 yml 重算为模块现状 yml，以当前代码为基准删去已删除项并归档迭代事实，供 requirement 实现对齐读取现状。
---

# 现状维护

以下规则具有最高优先级。

把 `.intentflow/_packages/` 下累积的迭代事实 yml（report 产出）重算为模块现状 yml。
迭代事实记录每次 feature 改了什么；现状事实记录当前代码实际存在什么。

## 核心规则

- 现状事实以当前代码为唯一基准，迭代历史的 change 只是判定线索
- 已删除、已归档的文件不记录
- 字段只用 packageName + summary + groups{name, summary, files}，无 files 改动事实，不新增字段
- 模块划分按功能内聚，粒度对齐一次任务会动的最小单元

## 执行

1. 收集 `.intentflow/_packages/` 下全部迭代 yml
2. 回放每个 yml 的 files 改动事实，判定每个文件的最终状态
3. 以当前代码校验：现存文件保留，已删除、已归档丢弃
4. 划分模块，每个模块写一份现状 yml 到 `.intentflow/_packages/<module>.yml`
5. 归档迭代 yml 到 `.archive/` 下 retired 目录

## 模块 yml 格式

- packageName：模块名
- summary：模块职责、入口文件、对外依赖
- groups：按功能内聚分组，每项含 name / summary / files
- files：该组内现存文件的相对路径

完成标志：`_packages/` 只剩模块现状 yml，每个 groups.files 与当前代码一致。
