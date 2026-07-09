# 退役能力 — Retired Capabilities

## 归档时间

2026-06-12

## 归档背景

在 `generate_capability_list` 重构过程中，移除了原设计中过度集成的职责。这些文件曾经是 "上帝工具" `GenerateCapabilityListUseCase` 的一部分，现在该工具已回归到「给定入口文件 → 返回直接依赖 + @intent」的原子能力。

详见：[架构依赖关系综合分析报告](../../.cdd/ARCHITECTURE_DEPENDENCY_ANALYSIS.md)

## 归档清单

| 文件 | 原职责 | 退役原因 |
|------|--------|---------|
| `ClusterByCallGraphUseCase.ts` | 基于调用图的 DFS 聚类算法，生成能力树 | 复杂聚类不再需要，工具只返回 1 层依赖 |
| `Capability.ts` | `Capability` 实体接口（entryIntent, branchIntents, subdivisions 等） | 旧输出格式废弃，改为扁平结构 |
| `CapabilityList.ts` | `CapabilityList` / `CapabilityLayer` 接口 | 旧分层包装格式废弃 |

## 关联变更

- `GenerateCapabilityListUseCase.ts` — 完全重写，新的简单接口
- `data/entities/index.ts` — 移除 `Capability`、`CapabilityList`、`Intent` 导出
- `CoreDIContainer.ts` — 移除 `clusterByCallGraphUseCase`、`scanIntentsUseCase` 注册
- `ICodeParserRepository.ts` — 移除 `extractIntentsFromDirectory`（职责不在同一抽象维度）
- `MCP DIContainer.ts` — 移除两个已废弃工具的注入

## 参考

- [FEATURE_ANALYSIS.md](../../.cdd/FEATURE_ANALYSIS.md) — 功能价值分析，解释了为什么回归简单设计
- [ARCHITECTURE_DEPENDENCY_ANALYSIS.md](../../.cdd/ARCHITECTURE_DEPENDENCY_ANALYSIS.md) — 架构分析报告
