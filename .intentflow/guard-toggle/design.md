# 设计文档：guard-toggle（守卫开关）

## 设计概览

顺应项目既有三层架构（adapter → application → data），完全复用 `scope/policy` 的"纯函数/接口/纯委托"模式，为 ToolAccessGuard 增加一个可持久化的运行时开关。

**核心思路**：开关状态以"守卫是否开启"（`enabled`）为语义，`enabled=true` 拦截（默认安全态），`enabled=false` 放行。放行判定由现有 OR 扩展实现：`shouldSkip('confirm-edit') || !guardToggle.isEnabled()`。

---

## 模块清单

| 模块 | 层级归属 | 职责 | 依赖哪些模块 |
|------|---------|------|-------------|
| `GuardToggleStore` | data（新增） | 读写 `.intentflow/guard-state.json`；不存在/损坏/非法 → 返回安全态 `true`（开启） | 无（仅 node:fs） |
| `IGuardToggleService` | application（新增） | 开关服务接口：`isEnabled()` / `toggle()` | 无 |
| `GuardToggleService` | application（新增） | 内存状态持有 + toggle 翻转 + 委托 store 持久化 | `GuardToggleStore`（data） |
| `GuardToggleCommand` | adapter（新增） | `/guard-auto` 斜杠命令：翻转开关 + notify 状态提示 | `IGuardToggleService`（application） |
| `ToolAccessGuard` | adapter（修改） | 放行条件扩展：开关关闭时跳过全部确认 | `IAccessPolicyService` + `IGuardToggleService`（application） |
| `CoreDIContainer` | application（修改） | 组装 store + service（data 实现统一在此 new） | `GuardToggleStore`、`GuardToggleService` |
| `DIContainer` | adapter（修改） | 经 core 获取 service，注入 ToolAccessGuard，暴露给命令 | `IGuardToggleService`（经 core，不 import data） |
| `extension.ts` | adapter（修改） | 注册 `GuardToggleCommand` | `DIContainer` |

---

## 依赖链

```
pi tool_call 事件 / /guard-auto 命令（用户入口）
        │
        ▼
ToolAccessGuard / GuardToggleCommand      [adapter/pi/tools, adapter/pi/commands]
        │  依赖 application 接口，不跨层
        ▼
IAccessPolicyService / IGuardToggleService   [application/services]
        │  纯委托
        ▼
policy.shouldSkip() / GuardToggleStore       [data/services/scope, data/services/guard]
        │
        ▼
process.env.PI_EXT_SKIP / .intentflow/guard-state.json
```

无跨层依赖。新增依赖方向全部为 上层 → 下层。

---

## 本次设计决策

### 1. 语义命名：`enabled`（守卫是否开启）
- `isEnabled(): boolean` — `true`=守卫开启（弹确认框拦截），`false`=守卫关闭（放行）
- 与需求"开关状态为关闭 → 放行"一致；`enabled` 正面语义优于 `isOff()`（避免双重否定）
- 配置文件格式：`{ "enabled": true }`

### 2. 放行判定用 OR 扩展，不改 IAccessPolicyService 接口
- 现有：`if (accessPolicy.shouldSkip('confirm-edit')) return;`
- 改为：`if (accessPolicy.shouldSkip('confirm-edit') || !guardToggle.isEnabled()) return;`
- 理由：PI_EXT_SKIP（子 agent 环境）与用户开关是两个独立来源，语义不同，不应混入同一接口；`shouldSkip` 接口签名保持不变，ScopePolicy 零改动

### 3. 同步读 + 异步写
- `GuardToggleStore.read(): boolean` — 同步读（构造时一次性加载，避免 tool_call 热路径异步竞态；文件极小无性能问题）
- `GuardToggleStore.write(enabled): Promise<void>` — 异步写，失败抛错
- `GuardToggleService.toggle()`：先翻转内存 → 再 await 写文件 → 写失败抛错（命令层 catch 后 notify error，**内存已翻转，本次会话生效**，符合需求"写入失败本次会话仍生效"）

### 4. 装配遵循 CoreDIContainer 约束
- `GuardToggleStore` 与 `GuardToggleService` 均在 `CoreDIContainer` 中 new（data 实现统一在 application 组装）
- `DIContainer` 经 `this.core.guardToggleService` 获取，**不 import data 层**（维持既有边界声明）
- `ToolAccessGuard` 构造签名扩展为 `(accessPolicy, guardToggle)`，`GuardToggleCommand` 注入同一 service 实例（单例，状态共享）

### 5. notify 级别设计
- 关闭（进入放行）：`'warn'` — 有风险操作，醒目提示
- 开启（恢复审查）：`'info'`
- 写失败：`'error'`，文案含"本次会话已生效"

### 6. 项目根目录取 `process.cwd()`
- 配置路径：`<cwd>/.intentflow/guard-state.json`
- 先例：`RpcProcessPool`、`SpawnAgentUseCase` 均以 `process.cwd()` 为项目根

---

## 改动点清单

### 新增文件（4）
| 文件 | 内容要点 |
|------|---------|
| `src/data/services/guard/GuardToggleStore.ts` | @intent + 类：`read()` 同步读（不存在/JSON 非法/字段非法 → 返回 `true` 安全态）；`write()` 异步写，失败抛错 |
| `src/application/services/IGuardToggleService.ts` | @intent + 接口：`isEnabled(): boolean`、`toggle(): Promise<boolean>`（返回新状态） |
| `src/application/services/GuardToggleService.ts` | @intent + 实现：构造时 `store.read()` 初始化内存态；`toggle()` 翻转 + 持久化 |
| `src/adapter/pi/commands/GuardToggleCommand.ts` | @intent + `register(pi)` 注册 `guard-auto` 命令；handler：try/toggle → notify；catch → notify error |

### 修改文件（4）
| 文件 | 改动 |
|------|------|
| `src/application/CoreDIContainer.ts` | 新增 `guardToggleStore` + `guardToggleService` 字段与初始化 |
| `src/adapter/pi/DIContainer.ts` | 新增 `guardToggleService` 字段（经 core 获取）；`ToolAccessGuard` 构造注入 |
| `src/adapter/pi/tools/ToolAccessGuard.ts` | 构造签名扩展；放行条件加 `\|\| !this.guardToggle.isEnabled()`；更新 @intent |
| `src/adapter/pi/extension.ts` | `new GuardToggleCommand(container.guardToggleService).register(pi)` |

### 测试规划（建议，随实现阶段）
- `GuardToggleStore` 单测：默认安全态、损坏 JSON 回退、写入后可读回
- `GuardToggleService` 单测：toggle 翻转、写失败时内存已翻转
- `ToolAccessGuard.integration.test.ts` 扩展：开关关闭时 edit 直接放行

---

## 既有结构观察（非本次修复）

- `src/data/services/scope/IAccessPolicy.ts` 在 @intent 中自述"疑似闲置，待清理确认"——与本次功能同域但无依赖关系，不动；已记入 later-on.md
- 未发现既有跨层依赖需要本次一并修复
