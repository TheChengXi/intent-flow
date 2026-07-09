# Pi 适配层

将 CCD 框架的 agent 发现与子进程调度能力暴露为 pi 扩展工具。
支持 `spawn_agent` 工具、`subagent` 工具（单次/链式）和 `/sub-skill` 命令。

## 架构

```
src/adapter/pi/
├── extension.ts              ← pi 扩展入口（部署到 ~/.pi/agent/extensions/）
├── DIContainer.ts            ← 依赖注入容器
├── index.ts                  ← 统一导出
├── README.md                 ← 本文件
├── agents/
│   ├── SubSkillRepository.ts ← Agent 发现（sub-skill 递归扫描）
│   ├── RpcProcessPool.ts     ← 常驻进程池管理（按需初始化）
│   └── SubProcessRunner.ts   ← 子进程运行器（RPC 池优先 → spawn 一次性回退）
└── tools/
    ├── index.ts              ← 工具统一导出
    ├── SpawnAgentTool.ts     ← spawn_agent 工具（含实时可视化）
    └── SubagentTool.ts       ← subagent 工具（单次/链式模式）
```

### 依赖关系（三层架构）

```
extension.ts (adapter/pi)
  → DIContainer
    → SpawnAgentTool / SubagentTool
      → SpawnAgentUseCase / DiscoverAgentsUseCase (application/)
        → SubSkillRepository / SubProcessRunner / RpcProcessPool (adapter.pi.agents/)
          → IAgentRepository / ISubProcessRunner (data/repositories/)
            → AgentDefinition / AgentRunResult / AgentUsage (data/entities/)
```

### 外部依赖（pi 运行时提供，不打包进产物）

| 包 | 用途 |
|---|------|
| `@earendil-works/pi-coding-agent` | ExtensionAPI 类型、tool 注册 API |
| `typebox` | Tool 参数 schema 定义 |
| `@earendil-works/pi-tui` | TUI 组件（Container, Text, Markdown） |

## 构建与部署

### 一键编译 + 部署

```bash
npm run compile:pi && npm run deploy:pi
```

### 分开执行

```bash
npm run compile:pi    # ≡ set CDD_BUILD=pi/extension && vite build → dist/pi/extension.js
npm run deploy:pi     # ≡ node scripts/deploy-pi.js → 复制到 ~/.pi/agent/extensions/ccd-framework/
```

部署后的目录结构：

```
~/.pi/agent/extensions/ccd-framework/
├── index.ts        ← pi 加载的入口（export { default } from "./extension.js"）
└── extension.js    ← Vite 编译产物（~19KB）
```

在 pi 中执行 `/reload` 即可加载扩展。

### 构建输出

| CDD_BUILD | 输出文件 | 用途 |
|---|---|---|
| `extension` | `dist/extension.js` | VSCode 扩展 |
| `cli/cdd` | `dist/cli/cdd.js` | CLI 工具 |
| `mcp-server` | `dist/mcp-server.js` | MCP 服务器 |
| `pi/extension` | `dist/pi/extension.js` | **Pi 扩展（this）** |

## 进程池生命周期

```
session_start  ──→ 注册 widget 占位，不启动任何进程
                     │
第一次 runTask ──→ ensureProcess → 按需 spawn 子进程
                     │
后续 runTask   ──→ 复用已有进程（进程池）
                     │
进程 crash     ──→ 自动重建
                     │
/reload        ──→ shutdown → 杀掉所有进程 → session_start → 保持 0 进程
                     │
再跑 runTask   ──→ 自动重新 spawn
```

- **不限定 agent 类型**：进程池通过 agent 名称（SUB-SKILL.md name）动态辨识
- **不强制预热**：`session_start` 不启动任何进程，全按需初始化
- **幂等预热**：`warmUp()` 已存在进程跳过，不会重复创建

## 子进程可视化

子进程运行时，`spawn_agent` 工具会自动：

| 展示方式 | 位置 | 内容 |
|---------|------|------|
| `setWidget` | 编辑器上方 | agent 名称、当前状态、当前调用的工具 |
| `setStatus` | 底部状态栏 | `{agent} 运行中...` / `{agent} 完成` |
| `onUpdate` | 对话上下文 | 关键节点推送（工具调用开始） |

不会被刷屏——只有最终结果返回对话，中间状态通过 widget 实时更新。

## 可用工具

| 工具名 | pi 注册名 | 说明 |
|---|---|---|
| `spawn_agent` | `spawn_agent` | 隔离子进程运行 agent，返回结构化结果，含实时可视化 |
| `subagent` | `subagent` | 单次模式 + 链式模式（chain[]） |
| `/sub-skill` | `sub-skill` | 列出所有可用 agent |
| `/sub-skill <skill>` | `sub-skill` | 只看该 skill 下的 agent |

### spawn_agent 参数

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `agent` | string | ✅ | — | Agent 名称（对应 SUB-SKILL.md 的 frontmatter name） |
| `task` | string | ✅ | — | 分配给 agent 的任务描述 |
| `context` | string | ❌ | — | 追加到 system prompt 末尾的上下文（链式传递用） |
| `model` | string | ❌ | agent 定义值 | 模型覆盖 |
| `timeoutMs` | number | ❌ | 600000 | 子进程超时（10 分钟） |

### subagent 参数

| 参数 | 类型 | 说明 |
|---|---|---|
| `agent` + `task` | string + string | 单次模式 |
| `chain[]` | `{agent, task}[]` | 链式模式，`{previous}` 自动替换为上一步输出 |

## Agent 发现机制

### 优先级

1. **sub-skill**（优先）：`~/.pi/agent/skills/<skill>/sub-skill/<agent>/SUB-SKILL.md`
   - 支持递归子目录（如 `tdd/test-writer/`）
   - 同级目录下的 `include/` 知识库自动注入
2. **user agents**（回退）：`~/.pi/agent/agents/*.md`
3. **同名去重**：sub-skill 覆盖 user agent（last-wins 策略）

### Agent 定义格式

SUB-SKILL.md 使用 YAML frontmatter：

```markdown
---
name: tdd-reviewer
description: 两层审查：spec compliance → code quality
tools: read
model: claude-sonnet-4
---

# TDD Reviewer
```

| frontmatter 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | Agent 名称（必填，唯一标识） |
| `description` | string | 描述（必填） |
| `tools` | string | 工具白名单，逗号分隔（可选） |
| `model` | string | 模型覆盖（可选，不填则使用主线模型） |

## 测试

```bash
# 跑所有测试
npm test

# 只跑 Pi 适配层相关测试
npx vitest run src/adapter/pi/
npx vitest run src/application/useCases/*Agent*

# 当前覆盖（11 文件 43 测试全绿）
#   - SubSkillRepository 集成测试（11 条）
#   - SpawnAgentUseCase 单元测试（4 条）
#   - DiscoverAgentsUseCase 单元测试（1 条）
```

## 开发指南

### 添加新工具

1. 在 `tools/` 下新建 `XxxTool.ts`
2. 构造函数注入对应 UseCase
3. 在 `tools/index.ts` 导出
4. 在 `DIContainer.ts` 实例化
5. 在 `extension.ts` 调用 `register()`

### 添加新 sub-agent

只需在 `~/.pi/agent/skills/<任意 skill>/sub-skill/<agent名>/SUB-SKILL.md` 中定义即可。
进程池自动发现，无需改代码。

### 路径注意事项

文件在 `src/adapter/pi/agents/` 下，引用 `src/data/` 需要 `../../../data/`（3 层上跳）：

```typescript
import type { IAgentRepository } from '../../../data/repositories/IAgentRepository';
```

### 调试

编译后的扩展可以通过 `console.log` 输出调试信息，pi 会在 stderr 中显示。
子进程中间事件可以通过 `spawn_agent` 工具的 `onUpdate` 回调观察。
