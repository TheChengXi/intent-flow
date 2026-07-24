# Pi 适配层

将 CDD 框架的 agent 发现与子进程调度能力暴露为 pi 扩展工具。
支持 `spawn_agent` 工具（调用子 agent）、`list_agents` 工具（查询可用子 agent）和 `/sub-agent` 命令（查看实时状态）。

## 架构

```
src/adapter/pi/
├── extension.ts              ← pi 扩展入口（部署到 ~/.pi/agent/extensions/）
├── DIContainer.ts            ← 依赖注入容器
├── index.ts                  ← 统一导出
├── README.md                 ← 本文件
├── tools/
│   ├── index.ts              ← 工具统一导出
│   ├── SpawnAgentTool.ts     ← spawn_agent 工具（含实时可视化）
│   ├── ToolAccessGuard.ts    ← 工具访问守卫（拦截确认）
├── services/
│   ├── ScopePolicy.ts        ← 访问策略桥接（IAccessPolicy 实现）
├── tui/
│   ├── index.ts              ← TUI 组件统一导出
│   ├── AgentRunTracker.ts    ← 子 agent 状态管理中心（数据源）
│   └── SubAgentView.ts     ← 监控视图 overlay（列表+日志+操作）
├── runtime/
│   ├── RpcProcessPool.ts     ← 常驻进程池管理（按需初始化）
│   └── SubProcessRunner.ts   ← 子进程运行器（RPC 池优先 → spawn 一次性回退）
├── repositories/
│   └── SubSkillRepository.ts ← Agent 发现（sub-skill 递归扫描）
├── commands/
│   ├── index.ts
└── DIContainer.ts
```

### 依赖关系（三层架构）

```
extension.ts (adapter/pi)
  → DIContainer
    → SpawnAgentTool
      → SpawnAgentUseCase / DiscoverAgentsUseCase (application/)
        → SubSkillRepository / SubProcessRunner / RpcProcessPool (adapter.pi.agents/)
          → IAgentRepository / ISubProcessRunner (data/repositories/)
            → AgentDefinition / AgentRunResult / AgentUsage (data/entities/)
    → ToolAccessGuard
      → IAccessPolicy (data/services/scope/)
        → ScopePolicy (adapter/pi/services/ 实现)
          → shouldSkip() (data/services/scope/ 同域引用)
```

### 外部依赖（pi 运行时提供，不打包进产物）

| 包 | 用途 |
|---|------|
| `@earendil-works/pi-coding-agent` | ExtensionAPI 类型、tool 注册 API |
| `typebox` | Tool 参数 schema 定义 |
| `@earendil-works/pi-tui` | TUI 组件（Container, Text, Markdown, matchesKey, Key 等） |

## 构建与部署

### 一键编译 + 部署

```bash
npm run compile:pi && npm run deploy:pi
```

### 分开执行

```bash
npm run compile:pi    # ≡ set CDD_BUILD=pi/extension && vite build → dist/pi/extension.js
npm run deploy:pi     # ≡ node scripts/deploy-pi.js → 复制到 ~/.pi/agent/extensions/cdd-framework/
```

部署后的目录结构：

```
~/.pi/agent/extensions/cdd-framework/
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

## 子 agent TUI 监控视图

命令 `/sub-agent` 打开子 agent 监控视图 overlay，
提供类似「小型主 agent 界面」的体验：

```
┌─────────────────────────────────────────────────────┐
│  SubAgent Monitor                    [q]关闭      │
├─────────────────────────────────────────────────────┤
│  # Agent               Status   Turns  Cost         │
│  ▸ ▶ run-code          运行中    3     -            │
│    ✓ review-code       完成      5     $0.02        │
│    ✗ test-code         失败      2     $0.01        │
├─────────────────────────────────────────────────────┤
│  run-code 日志                            [Enter]   │
│    14:23:01 🤔 思考中...                            │
│    14:23:02 🔧 read src/index.ts                   │
│    14:23:05 💬 代码重构完成                         │
├─────────────────────────────────────────────────────┤
│  ▶1运行中 ✓1完成 ✗1失败  共3个    ↑↓ k r q        │
└─────────────────────────────────────────────────────┘
```

### 自动弹出

调用 `spawn_agent` 工具时，监控视图**自动弹出**，实时显示子 agent 运行状态。
无需手动操作——观察子 agent 执行过程零额外成本。

监控视图关闭后，下次工具调用仍然会自动弹出。

### 键盘操作

| 按键 | 功能 |
|------|------|
| `↑` `↓` | 在 agent 列表中导航 |
| `Enter` | 查看选中 agent 的详细日志 |
| `Tab` | 在 agent 列表和日志区之间切换焦点 |
| `q` / `Esc` | 关闭监控视图 |
| `k` | 终止运行中的 agent（预留） |
| `r` | 重试失败的 agent（预留） |
| `/sub-agent` | 命令打开监控视图 |

### 数据流

```
工具调用 tracker.startRun()
  ↓ tracker.notify()（经 50ms 防抖合并）
tracker 订阅者（extension.ts）
  → SubAgentView 自动弹出（overlay）
  ↓
子 agent 执行中 → tool_call/thinking/output 事件
  ↓
tracker.addLog() → notify() → 视图实时更新
```

关键设计：
- **fire-and-forget**：视图弹出不阻塞工具执行
- **50ms 防抖**：高频工具调用不会打爆 TUI re-render
- **不绑定工具名**：任何工具注入 tracker 并调 startRun() 即可触发
不阻塞工具执行流程。用户关闭监控视图后，下次工具调用自动再打开。

### AgentRunTracker

单例状态中心，所有工具在执行中自动推送事件。屏蔽了工具内部实现差异：

- **spawn_agent**: tool_call、thinking、output、done 全链路推送

视图订阅 tracker 变更自动刷新（经 50ms 防抖合并），无需手动轮询。

## 进程池生命周期

```
session_start  ──→ 不启动任何进程
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

### 临时目录清理

每次 `spawn_agent` 调用会在系统临时目录（`os.tmpdir()`）下创建
`cdd-agent-XXXXX/` 或 `cdd-rpc-XXXXX/` 文件夹，内含 `system.md` 文件。

清理策略：

| 场景 | 清理方式 |
|------|---------|
| 子进程正常退出 | `exit` 事件 → `rm(tmpDir)` |
| 子进程崩溃 | `exit` 事件 → `rm(tmpDir)` |
| 用户 Ctrl+C | `session_shutdown` → `pool.shutdown()` → 逐进程终止 → `rm(tmpDir)` |
| `/new` / `/resume` / `/reload` | 同上，走 `session_shutdown` |
| 断电 / `taskkill /F` | ❌ 不触发任何 handler，会残留

残留目录以 `cdd-agent-` 或 `cdd-rpc-` 开头，位于系统临时目录下，
可手动删除，下次重启系统也会自动清空。

## 实时监控

子 agent 运行时，监控视图（SubAgentView）自动弹出 overlay，
提供完整的 agent 列表、实时日志和键盘操作。

中间状态通过 tracker 实时推送到视图，只有最终结果返回对话上下文。

## 可用工具

| 工具名 | pi 注册名 | 说明 |
|---|---|---|
| `spawn_agent` | `spawn_agent` | 隔离子进程运行 agent，返回结构化结果，含实时可视化 |
| `list_agents` | `list_agents` | 查询可用 sub-agent 列表，LLM 主动调用 |
| `/sub-agent` | `sub-agent` | 打开子 agent 监控视图（自动弹出 / /sub-agent命令） |

## 工具访问守卫

`ToolAccessGuard` 监听所有 `tool_call` 事件，在危险操作前弹出确认框，
防止误修改文件或执行破坏性 bash 命令。

### 拦截规则

| 规则 | 触发条件 | 行为 |
|---|---|---|
| **confirm-edit** | `edit` / `write` 工具调用 | 弹确认框，取消则询问原因并 block |
| **confirm-bash** | `bash` 工具 + 匹配危险模式 | 弹确认框，取消则询问原因并 block |

### 危险 bash 模式（17 条）

`rm -rf`、`rm -r`、`rmdir`、`del`、`remove`、`mv`、`cp`、
`>` 重定向、`| tee`、`dd`、`chmod`、`chown`、`mkfs`、`format`、`fdisk`、`sudo rm`、`:; rm`

### 作用域跳过

通过 `PI_EXT_SKIP` 环境变量控制：

```bash
# 子 agent 环境中跳过拦截（由主线程设置）
export PI_EXT_SKIP="confirm-edit"
```

子 agent 环境下 `shouldSkip("confirm-edit")` 返回 `true`，所有拦截直接放行。
策略定义在 `data/services/scope/policy.ts`，通过 `IAccessPolicy` 接口注入。

### 架构

```
ToolAccessGuard (adapter/pi/tools/)
  → IAccessPolicy (application/services/ 接口)
    → ScopePolicy (adapter/pi/services/ 桥接)
      → shouldSkip() (data/services/scope/ 纯函数)
```

严格按 DIP 分层：ToolAccessGuard 只依赖 application 层的接口，
不直接引用 data 层的具体实现。

### spawn_agent 参数

| 参数 | 类型 | 必填 | 默认 | 说明 |
|---|---|---|---|---|
| `agent` | string | ✅ | — | Agent 名称（对应 SUB-SKILL.md 的 frontmatter name） |
| `task` | string | ✅ | — | 分配给 agent 的任务描述 |
| `context` | string | ❌ | — | 追加到 system prompt 末尾的上下文（链式传递用） |
| `model` | string | ❌ | agent 定义值 | 模型覆盖 |
| `timeoutMs` | number | ❌ | 600000 | 子进程超时（10 分钟） |



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

# 当前覆盖（14 文件 85 测试全绿）
#   - SubSkillRepository 集成测试（11 条）
#   - SpawnAgentUseCase 单元测试（4 条）
#   - DiscoverAgentsUseCase 单元测试（1 条）
#   - ScopePolicy 单元测试（8 条）
#   - ToolAccessGuard 单元测试（30 条）
#   - ToolAccessGuard 集成测试（3 条）
```

## 开发指南

### 添加新工具

1. 在 `tools/` 下新建 `XxxTool.ts`
2. 构造函数注入对应 UseCase
3. 在 `tools/index.ts` 导出
4. 在 `DIContainer.ts` 实例化
5. 在 `extension.ts` 调用 `register()`

### 添加新拦截规则

1. 在 `ToolAccessGuard.ts` 中新增私有方法（如 `isDangerousSql(cmd)`）
2. 在 `register()` 的 handler 中增加对应 `toolName` 匹配分支
3. 规则保持私有方法，不做插件化预留

### 集成监控视图

新工具要出现在监控视图中只需两步：

1. 构造函数接收 `AgentRunTracker`（可选参数）
2. 在 `execute()` 中调用 `tracker.startRun()` / `tracker.addLog()` / `tracker.completeRun()`

```typescript
execute: async (toolCallId, params, signal, onUpdate, ctx) => {
  this.tracker?.startRun({ toolCallId, toolName: 'my_tool', agent, task, mode: 'single' });
  // ... 执行中 this.tracker?.addLog(toolCallId, { level: 'tool_call', text: '...' });
  this.tracker?.completeRun(toolCallId, { status: 'completed', output, turns, cost });
}
```

### 添加新 TUI 组件

1. 在 `tui/` 下新建组件文件
2. 组件实现 `render(width)` / `handleInput(data)` / `invalidate()` 三方法
3. 在 `tui/index.ts` 导出
4. 被 `SubAgentView` 引用或用于其他 overlay

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
