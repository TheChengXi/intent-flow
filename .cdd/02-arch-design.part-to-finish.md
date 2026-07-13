# 本次必须完成 — 架构设计：ToolAccessGuard

## 模块清单

| 模块 | 层级 | 职责 | 依赖关系 |
|------|------|------|----------|
| `IAccessPolicy` | `application/services/` | 访问策略接口，定义 `shouldSkip(name): boolean` | 零依赖 |
| `ScopePolicy` | `adapter/pi/services/` | `IAccessPolicy` 的 adapter 实现，委托给 `data/services/scope/policy` | → `IAccessPolicy` (application 接口)<br>→ `shouldSkip` (data 纯函数) |
| `ToolAccessGuard` | `adapter/pi/tools/` | 工具访问守卫，注册 `pi.on("tool_call")` 拦截 edit/write/bash 操作 | → `IAccessPolicy` (application 接口) |
| `DIContainer` | `adapter/pi/` | 新增 `accessPolicy` + `toolAccessGuard` 字段，组装依赖 | → `ScopePolicy` (adapter)<br>→ `ToolAccessGuard` (adapter) |
| `extension.ts` | `adapter/pi/` | 调用 `container.toolAccessGuard.register(pi)` 注册守卫 | → `DIContainer` |

## 最小依赖链

```
pi session 启动
  └→ extension.ts — register(ToolAccessGuard)
       └→ ToolAccessGuard.register(pi)
            ├→ pi.on("tool_call", ...)       ← 注册事件监听
            └→ this.accessPolicy.shouldSkip() ← 作用域判断
                 └→ ScopePolicy (adapter 桥接)
                      └→ shouldSkip() (data/services/scope 纯函数)
                           └→ process.env.PI_EXT_SKIP
```

## 依赖方向（严格单向）

```
adapter/pi/tools/ToolAccessGuard
  → application/services/IAccessPolicy (接口，无实现细节)

adapter/pi/services/ScopePolicy (桥接类)
  → application/services/IAccessPolicy (接口)
  → data/services/scope/policy (纯函数，被 adapter 层显式引用)

adapter/pi/DIContainer (组合根，跨层引用唯独在此允许)
  → adapter/pi/services/ScopePolicy
  → adapter/pi/tools/ToolAccessGuard

adapter/pi/extension.ts
  → adapter/pi/DIContainer
```

## ToolAccessGuard 内部规则架构

```
ToolAccessGuard.register(pi)
  │
  ├─ [全局守卫] accessPolicy.shouldSkip("confirm-edit")
  │    └─ true → 直接 return（子 agent 环境，放行所有）
  │
  ├─ [规则 1] confirm-edit 拦截
  │    └─ toolName ∈ {edit, write} → 弹确认框，拒绝则 block
  │
  └─ [规则 2] confirm-bash 拦截
       └─ toolName === "bash" ∧ isDangerousBash(cmd) → 弹确认框，拒绝则 block
```

规则以私有方法组织，每一规则独立可测。后续新增规则直接加新方法。

## 本次设计决策

### 为什么 `IAccessPolicy` 放在 application 层
- 按 DIP 原则，内层（data）定义的是具体实现（纯函数 `shouldSkip`），外层（adapter）需要使用策略抽象
- `application` 层作为中间层持有接口定义，符合「内层定义接口，外层实现接口」的约束
- adapter 层 `ToolAccessGuard` 只依赖 application 层的接口，不跨层引用 data

### 为什么需要 `ScopePolicy` 桥接类
- `data/services/scope/policy.ts` 的 `shouldSkip` 是纯函数的命名导出，不是类
- DIContainer 不能直接从 adapter 层跨层 import data 层（违反分层约束）
- `ScopePolicy` 在 adapter 层完成桥接，DIContainer 只引用 adapter 层的模块

### skip 扩展名保持 `"confirm-edit"` 不变
- `PI_EXT_SKIP` 环境变量中现有的 `confirm-edit` 配置继续生效
- 保留向后兼容，用户无需修改环境变量配置

### 当前不做的取舍
- **不做插件化规则注册机制** — 规则直接在 `ToolAccessGuard` 中按方法组织，不设计规则注册表
- **不做规则优先级** — 当前所有规则并行匹配，无冲突场景
- **不做规则独立开关** — 所有规则绑定在同一个 `shouldSkip` 全局开关上

## 改动文件清单

### 新增文件（3个）
| 文件 | @intent |
|------|---------|
| `src/application/services/IAccessPolicy.ts` | 访问策略接口。定义 `shouldSkip(extensionName: string): boolean`，供 adapter 层实现和消费。 |
| `src/adapter/pi/services/ScopePolicy.ts` | IAccessPolicy 的 adapter 层桥接实现。委托 `data/services/scope/policy.shouldSkip()` 执行实际判断。 |
| `src/adapter/pi/tools/ToolAccessGuard.ts` | 工具访问守卫。监听 `tool_call` 事件，拦截 edit/write/bash 操作，依赖 IAccessPolicy 做作用域跳过判断。 |

### 修改文件（3个）
| 文件 | 改动 |
|------|------|
| `src/adapter/pi/tools/index.ts` | 追加导出 `ToolAccessGuard` |
| `src/adapter/pi/DIContainer.ts` | 新增 `accessPolicy` 和 `toolAccessGuard` 字段及初始化 |
| `src/adapter/pi/extension.ts` | 新增 `container.toolAccessGuard.register(pi)` 调用 |

### 删除文件（1个）
| 文件 | 原因 |
|------|------|
| `C:\Users\王晨曦\.pi\agent\extensions\confirm-edit.ts` | 功能已内聚，外部扩展与内部守卫冲突 |
