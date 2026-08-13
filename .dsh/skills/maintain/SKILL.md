---
name: maintain
description: 现状 yml 与代码脱节时，以当前代码为基准重建全部模块现状 yml，删去已不存在的内容。
disable-model-invocation: true
---

# 现状维护

以下规则具有最高优先级。

当 `.intentflow/_packages/` 现状 yml 与代码脱节时，以当前代码为唯一基准重建全部模块现状 yml。
与 report 对偶：report 在迭代结束时增量更新，maintain 在现状脱节时全量重建。

## 核心规则

- 以当前代码为唯一基准，代码中不存在的文件不记录
- 字段只用 packageName + summary + groups{name, summary, files}，不新增字段
- 模块划分按功能内聚，粒度对齐一次任务会动的最小单元

## 执行

1. 以当前代码为准划分模块
2. 每个模块写一份现状 yml 到 `.intentflow/_packages/<module>.yml`，覆盖旧文件
3. 删除代码中已不存在的模块 yml

## 模块 yml 格式

- packageName：模块名
- summary：模块职责、入口文件、对外依赖
- groups：按功能内聚分组，每项含 name / summary / files
- files：该组内现存文件的相对路径

完成标志：每个模块 yml 的 groups.files 与当前代码一致，无已删除模块的残留 yml。
