# 分层设计文档：intentPackage 意图打包系统

## 数据层（Data Layer）

### 实体

#### IntentPackage（持久化实体）
- **`packageName: string`** — 包名，默认取文件夹名（必填）
- **`summary: string`** — 高层摘要（必填）
- **`groups: IntentGroup[]`** — 语义分组列表（必填，至少 1 组）
- **`crossRefs: CrossReference[]`** — 跨包弱引用（可选，默认 []）
- **`hash: string`** — 聚合哈希，所有源文件 @intent 的全量哈希（必填，内部字段）
- **`pinned: boolean`** — 锚定锁，防止 CI 自动覆盖（必填，默认 false，内部字段）
- **`deprecated: boolean`** — 废弃标记，源文件全部不存在时置 true（必填，默认 false，内部字段）
- **`embedding: number[]`** — 向量嵌入预留字段（可选，默认 []，内部字段）
- ****文件路径**：`.cdd/packages/<packageName>.yml`

#### IntentGroup
- **`name: string`** — 组名，如"用户注册"（必填）
- **`intent: string`** — 组的高层意图描述（必填）
- **`files: IntentFileRef[]`** — 映射到此组的文件列表（必填，至少 1 个）
- **验证规则**：同一个包内，一个文件只能出现在一个组中（不重复映射）

#### IntentFileRef
- **`path: string`** — 相对于项目根目录的文件路径（必填）
- **`intent: string`** — 该文件的 @intent 原文（必填）

#### CrossReference
- **`target: string`** — 目标包名（必填）
- **`reason: string`** — 跨包关联原因（必填）

#### IntentPackagePublicView（对外展示实体，不持久化）
- **`packageName: string`** — 包名
- **`summary: string`** — 高层摘要
- **`groups: IntentGroup[]`** — 语义分组（同 IntentGroup）
- **`crossRefs: CrossReference[]`** — 跨包弱引用
- **`stale?: boolean`** — 可选标记，读取时检测到 hash 不匹配时返回 true
- **规则**：从 IntentPackage 映射，去掉 hash / pinned / deprecated / embedding

### 仓库接口

#### IIntentPackageRepository
- **文件路径**：`src/data/repositories/IIntentPackageRepository.ts`
- **技术选型**：文件系统 + YAML 序列化（.cdd/packages/*.yml）

| 方法 | 说明 |
|------|------|
| `save(pkg: IntentPackage): Promise<void>` | 原子写入包文件。写入 = 写临时文件 → rename |
| `load(name: string): Promise<IntentPackage \| null>` | 读取包文件。文件不存在返回 null |
| `list(): Promise<string[]>` | 返回所有可用包名列表（不读文件内容，仅扫目录） |
| `listByFolder(folder: string): Promise<string[]>` | 按源文件夹筛选包名。文件夹路径不是包的持久字段时，通过扫描所有包文件的 groups[*].files 来反查 |
| `delete(name: string): Promise<void>` | 删除包文件 |
| `exists(name: string): Promise<boolean>` | 检查包文件是否存在 |

**关键实现要点**：
- 写入原子性：先写 `.cdd/packages/.<name>.tmp`，再 `rename` 成 `<name>.yml`
- 并发安全：CI 和手动命令可能同时触发写入，用文件锁或 rename 的原子特性避免竞态
- YAML 序列化：使用 js-yaml 库，读时允许额外未知字段（向后兼容）

#### IIntentHashService
- **文件路径**：`src/data/services/intentPackage/IntentHashService.ts`
- **技术选型**：纯计算服务，无持久化状态

| 方法 | 说明 |
|------|------|
| `calcHashForFolder(folderPath: string): Promise<string>` | 递归扫描文件夹内所有文件，读取每个文件的 @intent，计算全量聚合哈希。遍历时跳过 node_modules / dist 等黑名单目录 |
| `calcHashForFiles(filePaths: string[]): Promise<string>` | 针对指定文件列表计算 @intent 聚合哈希。用于 CI 场景：已知变更文件列表，不需要再扫描文件夹 |

**哈希算法**：
- 对每个文件：提取 @intent 文本（或文件不存在时用空字符串）
- 将所有 @intent 按文件路径字典序拼接
- 对拼接结果取 SHA256
- 聚合适用于：相同 @intent 集合始终产生相同 hash；@intent 顺序变化不影响同一集合的 hash（字典序保证）

## 应用层（Application Layer）

### 用例

#### UseCase①：GenerateIntentPackageUseCase（聚类生成引擎）
- **文件路径**：`src/application/useCases/GenerateIntentPackageUseCase.ts`
- **职责**：纯函数。接收一个文件夹的所有 @intent + 内部依赖关系，调用 LLM 聚类，返回 IntentPackage。不碰文件系统、不决策覆盖。
- **前置条件**：输入数据已收集完毕（由 ② 或外部调用方负责收集）
- **后置条件**：无副作用。仅返回结构化数据。
- **依赖仓库**：无（纯函数，不依赖 data 层接口）
- **依赖外部**：LLM 调用接口（通过构造函数注入，接口形式为 `(prompt: string) => Promise<string>`）
- **关键业务规则**：
  - 一次只消化一个文件夹的数据
  - LLM prompt 必须包含：所有 @intent 列表 + 文件间依赖关系 + 输出格式约束（YAML schema）
  - cross_refs 发现跨文件夹语义关联时只记录引用，不合并其他文件夹的文件
  - 输出必须包含 hash 字段（由调用方传入或由 use case 自行计算当前输入数据的 hash）

**输入参数**：
```typescript
interface GenerateIntentPackageInput {
  folderName: string;
  intents: Array<{ filePath: string; intent: string }>;
  dependencyEdges: Array<{ from: string; to: string }>;
}
```

**输出**：
```typescript
type GenerateIntentPackageOutput = IntentPackage;
```

#### UseCase②：MaintainIntentPackagesUseCase（增量维护）
- **文件路径**：`src/application/useCases/MaintainIntentPackagesUseCase.ts`
- **职责**：所有"是否覆盖包文件"的决策者。检测变更 → 触发 ① 重算 → 原子覆盖或降级保留。
- **前置条件**：文件夹路径有效
- **后置条件**：包文件可能被更新、保留、标记 deprecated，或报告警告
- **依赖仓库**：IIntentPackageRepository、IIntentHashService
- **依赖用例**：① GenerateIntentPackageUseCase
- **关键业务规则**：
  - **哈希不变** → 不做任何事
  - **哈希变 + pinned** → 不覆盖，CI 报告警告
  - **哈希变 + 未 pinned + ① LLM 成功** → 原子覆盖包文件
  - **哈希变 + 未 pinned + ① LLM 失败** → 保留旧包，CI 报告警告
  - **所有引用文件不存在** → 标记 deprecated
  - **部分文件不存在、部分存在** → 按普通哈希变更处理，触发生成

**输入参数**：
```typescript
interface MaintainIntentPackageInput {
  folderPath: string;
  changedFiles?: string[];  // 可选：已知变更文件列表，加速 hash 计算
}
```

**输出**：
```typescript
interface MaintenanceResult {
  action: 'no_change' | 'updated' | 'pinned_skipped' | 'llm_failed_kept_old' | 'deprecated';
  packageName: string;
  message: string;
}
```

#### UseCase③：IntentPackageQueryService（结构化访问入口，含语义检索）
- **文件路径**：`src/application/services/IntentPackageQueryService.ts`
- **职责**：提供只读查询入口。作为 MCP 工具和 CLI 的后端，屏蔽内部细节。
- **前置条件**：无
- **后置条件**：无副作用
- **依赖仓库**：IIntentPackageRepository
- **依赖外部**：LLM 调用接口（仅 searchPackages 需要，注入方式同 ①）

**方法签名**：

```typescript
class IntentPackageQueryService {
  async getPackage(name: string): Promise<IntentPackagePublicView | null>;
  async listPackages(includeDeprecated?: boolean): Promise<string[]>;
  async searchPackages(query: string): Promise<SearchResult[]>;
}
```

**`getPackage` 业务规则**：
- 加载 IntentPackage → 按映射规则构建 IntentPackagePublicView（去掉 hash/pinned/deprecated/embedding）
- 读取时可选择校验收到的 hash 与当前源文件的 hash 是否一致，不一致则加 stale: true
- deprecated 的包返回 null（对外不可见）

**`listPackages` 业务规则**：
- 默认排除 deprecated 包
- 可选的 `includeDeprecated: true` 参数用于管理场景

**`searchPackages` 业务规则**：
- 先后做两轮筛选降低成本：
  1. 先读取所有包名 + summary（轻量），用 LLM 粗筛一次
  2. 对粗筛命中的包，读取完整内容，用 LLM 精排
- 输出包含：匹配的包名、匹配的组名、匹配理由
- 预留 embedding 字段，未来可升级为向量检索（按余弦相似度召回 → LLM 精排）

```typescript
interface SearchResult {
  packageName: string;
  matchedGroup: string;
  relevance: 'high' | 'medium' | 'low';
  reason: string;
}
```

## 适配层（Adapter Layer）

### 输入适配器

#### GetIntentPackageTool（MCP / Chat）
- **入口**：MCP Server 按工具名 `get_intent_package` 分发
- **调用的用例**：③ IntentPackageQueryService.getPackage()
- **输入格式**：
```typescript
interface GetIntentPackageInput {
  name: string;  // 包名
}
```
- **输出格式**：
```typescript
// 直接返回 IntentPackagePublicView
{
  packageName: "auth",
  summary: "用户认证全流程",
  groups: [...],
  crossRefs: [...],
  stale: false
}
```
- **错误处理**：包不存在时返回 `{ error: "package not found: auth" }`

#### ListIntentPackagesTool（MCP / Chat）
- **入口**：MCP Server 按工具名 `list_intent_packages` 分发
- **调用的用例**：③ IntentPackageQueryService.listPackages()
- **输入格式**：
```typescript
interface ListIntentPackagesInput {
  includeDeprecated?: boolean;  // 默认 false
}
```
- **输出格式**：
```typescript
{ packages: ["auth", "notification", "user-profile"] }
```

#### SearchIntentPackagesTool（MCP / Chat）
- **入口**：MCP Server 按工具名 `search_intent_packages` 分发
- **调用的用例**：③ IntentPackageQueryService.searchPackages()
- **输入格式**：
```typescript
interface SearchIntentPackagesInput {
  query: string;  // 自然语言查询，如 "注册后发邮件"
}
```
- **输出格式**：
```typescript
{
  results: [
    { packageName: "auth", matchedGroup: "用户注册", relevance: "high", reason: "注册流程包含邮件触发" },
    { packageName: "notification", matchedGroup: "邮件发送", relevance: "high", reason: "负责实际邮件投递" }
  ]
}
```

#### IntentPackageCommand（CLI）
- **入口**：`cdd intent-package <subcommand> [args]`
- **调用的用例**：② MaintainIntentPackagesUseCase、③ IntentPackageQueryService

| 子命令 | 参数 | 调用的用例 | 说明 |
|--------|------|-----------|------|
| `cdd intent-package update [folder]` | folder 可选，默认全项目 | ② | CI 或手动触发增量重算 |
| `cdd intent-package list` | — | ③ listPackages | 列举所有包 |
| `cdd intent-package get <name>` | name 必填 | ③ getPackage | 查看单个包详情 |
| `cdd intent-package search <query>` | query 必填 | ③ searchPackages | 语义搜索 |

- **输出格式**：默认终端可读的格式化文本；支持 `--json` 输出结构化数据（复用已有的 formatter 模式）

### 输出适配器

#### IntentPackageRepositoryImpl（文件系统）
- **实现的接口**：IIntentPackageRepository
- **技术选型**：Node.js fs/promises + js-yaml
- **关键实现要点**：
  - `.cdd/packages/` 目录自动创建（目录不存在时第一次 save 自动 mkdir）
  - 写入原子性：先写 `.tmp`，再 rename
  - YAML 序列化：使用 js-yaml `dump` / `load`，schema 允许额外字段
  - 读取容错：YAML 格式损坏时返回 null 并记录日志

#### IIntentHashService 的实现（文件系统）
- **技术选型**：Node.js crypto.createHash('sha256') + fs/promises
- **关键实现要点**：
  - IntentExtractor 复用现有服务提取 @intent
  - 跳过黑名单目录：node_modules、dist、.git、.cdd
  - 仅处理支持语言的文件（通过 LanguageConfig.getLanguageFromExtension 判断）
  - 文件不存在时视为空字符串（不中断整体计算）

## 数据流

### 关键流程：CI 自动增量更新包

```
Git commit
    │
    ▼
CI detect changed files
    │ 传 changedFiles[]
    ▼
② MaintainIntentPackagesUseCase.execute(folderPath, changedFiles)
    │
    ├── IntentHashService.calcHashForFiles(changedFiles)
    │   → IntentExtractor 提取每个文件的 @intent
    │   → SHA256(all intents by path sorted)
    │   → 新 hash
    │
    ├── IntentPackageRepository.load(folderName)
    │   → 旧 hash
    │
    ├── 对比：新 hash == 旧 hash?
    │   → 是 → action: no_change, return
    │
    ├── 对比：旧包 pinned == true?
    │   → 是 → action: pinned_skipped, CI warn, return
    │
    ├── 否 → 收集文件夹内全部 intents + 依赖
    │   → 调用 ① GenerateIntentPackageUseCase.execute(input)
    │
    ├── ① LLM 失败?
    │   → 是 → action: llm_failed_kept_old, CI warn, return
    │
    └── ① 成功 → IntentPackageRepository.save(newPackage)
        → action: updated, CI success
```

### 关键流程：开发者语义搜索

```
开发者 / LLM Agent
    │  search_intent_packages({ query: "注册后发邮件" })
    ▼
③ SearchIntentPackagesTool（MCP 适配器）
    │  校验 query 参数
    ▼
③ IntentPackageQueryService.searchPackages("注册后发邮件")
    │
    ├── 第一轮（轻量）：
    │   IntentPackageRepository.list() → 所有包名
    │   load 每个包的 summary + packageName（不加载完整 groups）
    │   LLM 粗筛：query + summary → 候选包列表
    │
    ├── 第二轮（精准）：
    │   对候选包 load 完整数据
    │   LLM 精排：query + groups + crossRefs → 匹配的 group
    │
    └── 返回 SearchResult[]
    │
    ▼
开发者 → 看到结果 → 调 get_intent_package("auth") 获取完整包内容
```

### 关键流程：新项目首次生成全量包

```
开发者首次运行
    │  cdd intent-package update
    ▼
② MaintainIntentPackagesUseCase
    │
    ├── 扫描项目根目录下的第一层子文件夹作为候选包
    │   （跳过 node_modules / dist / .git）
    │
    ├── 对每个文件夹：
    │   ├── 计算 hash（当前不存在包文件，视为"hash 必定不同"）
    │   ├── pinned? → 否（新包默认未 pinned）
    │   └── 调用 ① → 生成 → 保存
    │
    └── 全量生成所有包后，输出报告：
        已生成 N 个包，跳过 M 个空文件夹
```
