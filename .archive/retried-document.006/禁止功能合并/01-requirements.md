# 需求文档：ToolAccessGuard — 将扩展管控内聚到 pi 适配器组件

## 一句话目标

系统能够将 `confirm-edit` 的文件修改确认拦截功能内聚到 `src/adapter/pi` 组件中，通过 `ToolAccessGuard` 统一管理主线程与子 agent 的工具访问拦截规则，并依赖 `data/services/scope/policy` 的作用域策略进行跳检查。

## 涉及范围

### 新增文件
| 文件 | 职责 |
|------|------|
| `src/data/services/scope/IAccessPolicy.ts` | 访问策略接口，定义 `shouldSkip(name): boolean`，与 `policy.ts` 实现同域 |
| `src/adapter/pi/tools/ToolAccessGuard.ts` | 工具访问守卫，注册 `tool_call` 拦截，依赖 `IAccessPolicy` 接口 |

### 修改文件
| 文件 | 改动内容 |
|------|---------|
| `src/adapter/pi/extension.ts` | 注册 `ToolAccessGuard`（类似 `spawnAgentTool.register(pi)`） |
| `src/adapter/pi/DIContainer.ts` | 新增 `accessPolicy` 和 `toolAccessGuard` 字段，完成依赖组装 |
| `src/adapter/pi/tools/index.ts` | 导出 `ToolAccessGuard` |
| `src/data/services/scope/policy.ts` | 可选：补充 `IAccessPolicy` 接口实现（纯函数签名已匹配） |

### 删除文件
| 文件 | 原因 |
|------|------|
| `C:\Users\王晨曦\.pi\agent\extensions\confirm-edit.ts` | 功能已内聚到组件，存在冲突 |

### 依赖关系

```
ToolAccessGuard (adapter)
  └─ 依赖 IAccessPolicy (data/services/scope 接口)
       └─ 实现: ScopePolicy (adapter/pi/services)
            └─ 委托 shouldSkip (data/services/scope/policy 纯函数)
                 └─ DIContainer 负责组装
```

### 核心业务规则

1. **`edit`/`write` 拦截** — 任何 `tool_call` 事件中 toolName 为 `edit` 或 `write` 时，弹出确认对话框，用户拒绝则阻止操作
2. **危险 bash 拦截** — `tool_call` 中 toolName 为 `bash` 且命令匹配危险模式时，弹出确认对话框
3. **作用域跳过** — 当 `shouldSkip("confirm-edit")` 返回 `true`（子 agent 环境），直接放行所有操作
4. **可扩展拦截规则** — `ToolAccessGuard` 按策略模式设计，后续新增拦截规则只需添加新的策略实现

### 非功能需求

- 纯函数策略（`shouldSkip`、`isDangerousBash`）保持零依赖、可单测
- 不与现有的 `spawnAgentTool` / `listAgentsTool` 功能冲突
