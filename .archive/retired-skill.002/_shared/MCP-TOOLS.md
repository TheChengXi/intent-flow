# MCP 工具使用指南

CDD Framework 通过 MCP (Model Context Protocol) 提供了一系列代码分析工具。这些工具可以帮助你理解现有代码、提取上下文、搜索定义。

---

## 🔧 可用工具

### 1. search_function_definition

**用途**：搜索函数定义

**参数**：
- `name` (string) - 函数名称
- `filePath` (string) - 文件路径
- `language` (string, 可选) - 编程语言（自动检测）

**返回**：
- 函数的完整定义（包含注释、签名、函数体）
- 函数所在的行号范围

**使用场景**：
- 了解某个函数的实现细节
- 查看函数的契约注释
- 分析函数的参数和返回值

**示例**：
```typescript
// 搜索 getUserById 函数
search_function_definition("getUserById", "src/services/UserService.ts")

// 返回：
{
  "name": "getUserById",
  "startLine": 15,
  "endLine": 25,
  "code": "async function getUserById(id: string): Promise<User> { ... }"
}
```

---

### 2. search_type_definition

**用途**：搜索类型定义（interface、type、class、enum）

**参数**：
- `name` (string) - 类型名称
- `filePath` (string) - 文件路径
- `language` (string, 可选) - 编程语言（自动检测）

**返回**：
- 类型的完整定义
- 类型所在的行号范围

**使用场景**：
- 了解数据结构
- 查看类型的字段和方法
- 分析类型之间的关系

**示例**：
```typescript
// 搜索 User 类型
search_type_definition("User", "src/types/User.ts")

// 返回：
{
  "name": "User",
  "startLine": 5,
  "endLine": 12,
  "code": "interface User { id: string; name: string; ... }"
}
```

---

### 3. extract_code_context

**用途**：提取代码上下文（包含依赖的函数和类型）

**参数**：
- `filePath` (string) - 文件路径
- `startLine` (number, 可选) - 起始行号
- `endLine` (number, 可选) - 结束行号
- `depth` (number, 可选) - 依赖深度（默认 1）

**返回**：
- 指定范围的代码
- 依赖的函数定义
- 依赖的类型定义
- 导入语句

**使用场景**：
- 理解一段代码的完整上下文
- 分析代码的依赖关系
- 获取足够的信息来修改代码

**示例**：
```typescript
// 提取 10-50 行的代码及其依赖（深度 2）
extract_code_context("src/services/UserService.ts", 10, 50, 2)

// 返回：
{
  "mainCode": "...",
  "dependencies": {
    "functions": [...],
    "types": [...],
    "imports": [...]
  }
}
```

---

### 4. search_contracts

**用途**：搜索契约注释（@contract、@step、@boundary）

**参数**：
- `directory` (string) - 搜索目录
- `recursive` (boolean, 可选) - 是否递归搜索（默认 true）

**返回**：
- 所有包含契约注释的文件
- 每个契约的详细信息

**使用场景**：
- 了解模块的契约和边界
- 查看业务规则
- 分析模块之间的接口

**示例**：
```typescript
// 搜索 src/ 目录下的所有契约
search_contracts("src/")

// 返回：
{
  "contracts": [
    {
      "file": "src/services/UserService.ts",
      "function": "getUserById",
      "contract": "@contract: getUserById(id: string) => Promise<User>",
      "steps": [...],
      "boundaries": [...]
    }
  ]
}
```

---

## 📊 自动监控

所有 MCP 工具调用会自动触发 Hook，记录以下信息：

### 性能指标（MetricsHook）
- ⏱️ **执行耗时**：P50、P95、P99、平均值
- 💾 **缓存命中率**：减少重复计算
- 📈 **调用统计**：每 100 次调用输出一次统计

### 日志记录（LoggingHook）
- 📝 **操作日志**：记录每次工具调用
- ❌ **错误日志**：记录失败的调用
- 🔍 **调试信息**：帮助排查问题

### 缓存优化（CacheHook）
- 💾 **结果缓存**：缓存提取和搜索结果
- ⚡ **性能提升**：避免重复解析 AST
- 🔄 **自动失效**：文件修改后自动更新缓存

---

## 💡 使用建议

### 1. 渐进式探索
- 先用 `search_contracts` 了解整体架构
- 再用 `search_type_definition` 了解数据结构
- 最后用 `search_function_definition` 了解具体实现

### 2. 合理设置深度
- `depth=1`：只获取直接依赖（快速）
- `depth=2`：获取二级依赖（平衡）
- `depth=3+`：获取深层依赖（慢，谨慎使用）

### 3. 利用缓存
- 重复调用相同的工具会命中缓存
- 缓存会在文件修改后自动失效
- 查看缓存命中率来优化调用策略

### 4. 错误处理
- 工具调用失败会触发 `on_error` Hook
- 错误信息会被记录到日志
- 可以通过日志排查问题

---

## 🔗 相关文档

- [架构设计文档](../../.cdd/ARCHITECTURE.md) - 详细的架构说明
- [Hook 系统说明](HOOKS.md) - 了解 Hook 的工作原理
- [工作流程](WORKFLOW.md) - 了解 CDD 的整体流程
- [术语表](GLOSSARY.md) - 了解 CDD 的术语定义

---

## 🎯 能力清单工具（新增）

能力清单系统是 CDD Framework v0.2+ 的核心功能，支持 AI 驱动的代码迭代。

### 1. generate_capability_list

**用途**：从指定的入口文件开始，生成分层的能力清单

**参数**：
- `entryFiles` (必填) - 入口文件列表（绝对路径数组），例如：`["src/adapter/mcp/MCPServer.ts", "src/extension.ts"]`
- `projectRoot` (可选) - 项目根目录，默认为当前工作目录
- `directoryPath` (可选) - 扫描目录，默认为 projectRoot/src
- `recursive` (可选) - 是否递归扫描，默认 true
- `maxDepth` (可选) - 最大细分深度，默认 5

**重要说明**：
- ⚠️ **必须提供 entryFiles 参数**，否则工具将拒绝执行
- 工具从入口文件开始，通过调用关系构建能力树
- 不会全量扫描所有文件，只分析从入口可达的代码

**使用场景**：
- 了解特定模块的架构和依赖
- 查看从某个入口点可达的所有能力
- AI 基于实际调用关系推断新功能实现方式

---

### 2. list_layer_capabilities

**用途**：查看特定架构层的所有能力

**参数**：
- `layer` (必填) - 层级名称："Data"、"Application" 或 "Adapter"
- `projectRoot` (可选) - 项目根目录
- `directoryPath` (可选) - 扫描目录

**使用场景**：
- 快速查看某一层的能力
- 发现孤立能力（未被使用的功能）
- 评估某一层的完整性

---

### 3. search_capability_by_keyword

**用途**：快速搜索相关的能力

**参数**：
- `keyword` (必填) - 搜索关键词
- `projectRoot` (可选) - 项目根目录
- `directoryPath` (可选) - 扫描目录
- `scope` (可选) - 搜索范围

**使用场景**：
- 查找特定功能的实现
- 发现相关的能力
- 支持中英文混合搜索

---

## 🤖 AI 驱动的迭代

在 VSCode Claude Code 聊天面板中直接使用这些工具：

```
"请从 src/adapter/mcp/MCPServer.ts 入口分析能力清单"

AI 会：
1. 调用 generate_capability_list，指定 entryFiles: ["src/adapter/mcp/MCPServer.ts"]
2. 分析从 MCPServer 可达的所有能力和依赖关系
3. 理解代码模式（如 DIContainer、UseCase 结构）
4. 调用 search_capability_by_keyword 查找相关能力
5. 自动推断新功能应该遵循什么模式
6. 生成完整代码（无需人工指导）
```

**示例**：
```typescript
// 分析 MCP Server 的能力树
generate_capability_list({
  entryFiles: ["d:/w_dev/CCD-framework/src/adapter/mcp/MCPServer.ts"]
})

// 分析多个入口点
generate_capability_list({
  entryFiles: [
    "d:/w_dev/CCD-framework/src/adapter/mcp/MCPServer.ts",
    "d:/w_dev/CCD-framework/src/extension.ts"
  ]
})
```
