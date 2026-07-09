# Pi 适配层核心需求

> 将 agent-spawn 扩展能力纳入 CCD 框架，新增 `src/adapter/pi/` 适配层。

## 核心功能

### 功能 1：系统能够以 sub-skill 方式发现 agent，并自动注入 include/ 知识库
- **发现路径优先级**：`skills/<skill>/sub-skill/<agent>/SUB-SKILL.md`（优先）→ `~/.pi/agent/agents/*.md`（回退）
- **关键约束**：agent 定义支持 YAML frontmatter（name/description/tools/model）；`include/` 目录下的 .md 文件自动拼入 systemPrompt
- **来源**：`agent-spawn.ts` 的 `discoverAgents()` + `loadIncludes()`
- **驱动**：功能 1 → 功能 2（发现结果是运行的输入）

### 功能 2：系统能够在隔离子进程中运行 agent，支持单次、并行、链式三种模式
- **关键约束**：子进程有独立上下文/工具白名单/模型；支持 `{previous}` 占位符链式传递；并行最多 8 任务 4 并发
- **来源**：pi 官方 `subagent` 示例的 `runSingleAgent()` + `mapWithConcurrencyLimit()`
- **保留特性**：TUI 渲染（renderCall/renderResult）、AbortSignal 传播、usage 跟踪、JSON Lines 流式解析

### 功能 3：系统能够以 CCD 适配层的标准形式封装，并通过 `npm run compile:pi` 部署
- **关键约束**：遵循 CCD 适配层模式（DIContainer、README.md、统一导出）；构建产物自动安装到 `~/.pi/agent/extensions/ccd-framework/`
- **来源**：参考 `src/adapter/mcp/` 的目录结构 + `vite.config.ts` + postbuild 脚本

## 核心功能关系矩阵

| | 功能 1（发现） | 功能 2（运行） | 功能 3（适配层） |
|---|---|---|---|
| **功能 1** | — | 提供 AgentConfig[] 作为运行输入 | 发现逻辑被 index.ts 和 DIContainer 共同引用 |
| **功能 2** | 依赖功能 1 的输出 | — | 运行逻辑被 extension.ts 使用 |
| **功能 3** | 约束目录结构（sub-skill 路径） | 约束构建输出路径 | — |
| **冲突** | 无 | 无 | 无 |

**关系类型**：主（功能 2）+ 支撑（功能 1 + 功能 3）的流水线结构。

## 验证场景

### 场景：「用 scout agent 扫描 CCD 项目结构」

```
用户输入 → CCD 的 pi 适配层收到请求
  → 功能 1: 扫描 skills/ccd-core/sub-skill/scout/SUB-SKILL.md
     → 发现 scout agent（tools: read,grep,find,ls）
     → 读取 include/ 注入参考规范
  → 功能 3: pi adapter 的 SpawnAgentUseCase 被调用
  → 功能 2: 在子进程启动 pi --mode json，运行 scout
  → 收集 JSON Lines 输出
  → 返回结果给用户
```

**验证结果**：✅ 三个核心功能全部参与，依赖关系成立。

## 范围压缩线

- **必须保留**：功能 1（sub-skill 发现 + include 注入）+ 功能 2（子进程运行 + 三种模式）
- **可延后**：功能 3 中的自动安装脚本（可以先手动复制，后期再自动化）
