# IntentPackage — 意图打包系统

## 这是什么

IntentPackage 是一个**概念编译工具**。它把代码库中每个文件头部的 `@intent` 自然语言描述，按语义相似性自动分组打包，形成比单文件更高层的**模块级概念地图**。

```
代码 (每个文件有 @intent)
    │
    ├─ trace_dependency_chain  →  纵向：依赖链追踪
    ├─ list_folder_intents       →  横向：文件夹内意图投影
    │
    └─ V × H → LLM 聚类 → 意图包 (.cdd/packages/*.yml)
                            │
                            ├─ 摘要：一句话说清这包在干嘛
                            ├─ 分组：语义相近的意图聚成一簇
                            ├─ 映射：每个意图对应到具体文件
                            └─ 关联：包与包之间的语义引用
```

## 核心概念

### 包（Package）
以**文件夹**为基本单位，一个文件夹对应一个意图包。包的命名默认取文件夹名。

### 语义分组（Group）
包内按功能语义分成多个组，每组包含一个高层描述和指向具体文件的映射。

### 跨包引用（Cross Reference）
当某个功能语义跨越文件夹边界时，不会强行合并，而是在包中用 `cross_refs` 记录一条"弱引用"。例如 `auth` 包的 `cross_refs` 可能指向 `notification` 包。

### 哈希保鲜
每个包保存时附带一个**聚合哈希** —— 由该文件夹所有 `@intent` 内容计算得来。当代码中的 `@intent` 变更时，哈希会变化，系统检测到后自动触发增量重算。

### 锚定（Pinned）
开发者可以锁定某个包的聚类结果。锁定后即使 `@intent` 变更，CI 也不会自动覆盖包文件，而是报警等待开发者手动处理。

## CLI 用法

```
cdd intent-package <subcommand> [args]

子命令：
  update <folder>       增量重算目标文件夹的意图包
  list                  列举所有可用的包
  get <name>            查看单个包的详细内容
  search <query>        语义搜索：输入自然语言，返回匹配的包和分组

选项：
  --json                以 JSON 格式输出
```

### 查看所有包
```bash
cdd intent-package list
# → auth, notification, user-profile

cdd intent-package list --json
# → { "packages": ["auth", "notification", "user-profile"] }
```

### 查看单个包
```bash
cdd intent-package get auth
# → 包名: auth
#    摘要: 用户认证全流程
#    分组:
#      用户注册 - register.ts, validator.ts
#      密码管理 - password.ts, reset.ts
#    关联: notification, user-profile
```

### 语义搜索
```bash
cdd intent-package search "注册后发邮件"
# → 匹配结果:
#    auth (用户注册) - 高: 注册流程包含邮件触发
#    notification (邮件发送) - 高: 负责实际邮件投递
```

### 更新指定文件夹的包
```bash
cdd intent-package update src/services/auth
# → auth: 意图包已更新
```

## MCP 工具

意图包系统通过三个 MCP 工具对外暴露，供 Claude 或其他 LLM Agent 调用：

| 工具 | 作用 |
|------|------|
| `get_intent_package` | 获取单个包的公开视图（摘要 + 分组 + 文件映射） |
| `list_intent_packages` | 列举所有可用的包名 |
| `search_intent_packages` | 语义检索，输入自然语言返回匹配的包和组 |

这三个工具通过 MCP Server 自动注册，调用方式和项目现有的 `trace_dependency_chain` 等工具一致。

## 包文件结构

包存储在 `.cdd/packages/<包名>.yml`，格式示例：

```yaml
packageName: auth                 # 包名
summary: 用户认证全流程            # 高层摘要
groups:                           # 语义分组
  - name: 用户注册
    intent: 接收注册请求、校验输入、创建用户
    files:
      - path: register.ts
        intent: 注册请求处理
      - path: validator.ts
        intent: 输入校验规则
crossRefs:                        # 跨包关联
  - target: notification
    reason: 邮件发送依赖通知模块
```

对外查询时，hash / pinned / deprecated / embedding 等内部字段会被自动屏蔽。

## 与现有工具的关系

```
                    intentPackage (概念地图)
                         ↑
              ┌──────────┼──────────┐
              │          │          │
    generate_capability  list_     LLM
    _list (依赖链追踪)  folder_    聚类引擎
                       intents
              │          │
              └──────────┘
                   @intent
```

- `trace_dependency_chain` 提供纵向依赖链
- `list_folder_intents` 提供横向文件夹投影
- 两者的网格 → LLM 聚类 → 意图包
- 意图包不替代这两个工具，而是它们的上一层组合产物

## 设计原则

1. **不是文档，是派生视图** — 包文件从代码自动生成，哈希指纹确保同步
2. **不是文档，就不会腐烂** — @intent 变更 → 哈希失效 → 增量重算
3. **文件夹是原子单位** — 一次 LLM 调用只消化一个文件夹，费用可控
4. **跨文件夹不强聚合** — 用 `cross_refs` 建立轻量语义图
5. **只通过工具暴露** — AI 不直接读包文件，屏蔽内部细节
