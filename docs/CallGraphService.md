# CallGraphService 实现文档

## 概述

CallGraphService 是一个基于 Tree-sitter 的调用图分析服务，用于精确分析代码中的函数调用关系。它已集成到 CDD Framework 的编译流程中，用于自动收集函数依赖。

## 核心功能

### 1. 构建文件级调用图

```typescript
const graph = await CallGraphService.buildFileCallGraph(filePath, language);
```

- 使用 Tree-sitter 解析代码为 AST
- 提取所有函数定义
- 分析每个函数内的函数调用
- 构建双向调用关系（callers 和 callees）
- 基于文件修改时间的内存缓存

### 2. 查询调用关系

```typescript
// 查询谁调用了某个函数
const callers = CallGraphService.getCallers('functionName', graph);

// 查询某个函数调用了谁
const callees = CallGraphService.getCallees('functionName', graph);
```

### 3. 收集依赖（深度优先遍历）

```typescript
// 收集函数的所有依赖（默认深度3）
const deps = CallGraphService.collectDependencies('functionName', graph, 3);
```

## 技术实现

### Tree-sitter 集成

使用 `web-tree-sitter` 包进行 AST 解析：

- **初始化**: 单例模式，避免重复初始化
- **语言加载**: 从 `parsers/` 目录加载官方 wasm 文件
- **AST 遍历**: 递归遍历查找函数定义和调用节点

### 支持的语言

当前支持以下语言（已下载官方 wasm 文件）：

- TypeScript
- TSX
- JavaScript
- Python

其他语言（需要下载对应的 wasm 文件）：

- C/C++
- Java
- Go
- Rust
- Kotlin
- Swift
- C#
- Ruby
- PHP

### Wasm 文件来源

**重要**: 必须使用官方 `web-tree-sitter` 兼容的 wasm 文件，从以下地址下载：

```bash
# TypeScript
https://github.com/tree-sitter/tree-sitter-typescript/releases/latest

# JavaScript
https://github.com/tree-sitter/tree-sitter-javascript/releases/latest

# Python
https://github.com/tree-sitter/tree-sitter-python/releases/latest
```

普通的 tree-sitter wasm 文件缺少 `dylink.0` 段，无法在 Node.js 环境中使用。

## 集成到 CompilerVM

### 增强的依赖提取

CompilerVM 的 `extractDependencies` 方法现在支持两种模式：

1. **Tree-sitter 模式**（精确）:
   - 当提供 `filePath` 和 `language` 时启用
   - 创建临时文件供 CallGraphService 分析
   - 提取所有函数的实际调用关系
   - 自动清理临时文件

2. **正则模式**（兜底）:
   - 当 Tree-sitter 失败或参数不足时使用
   - 使用正则表达式匹配函数调用
   - 保证基本功能可用

### 使用示例

```typescript
// CompilerVM 内部自动调用
const dependencies = await this.extractDependencies(
  code,
  context.filePath,
  targetLang
);
```

## 测试

### 运行测试

```bash
npx ts-node scripts/testCallGraph.ts
```

### 测试用例

测试文件: `test-cases/callgraph-test.ts`

包含 6 个函数的调用关系：

```
validateUser -> checkFormat
getUserInfo -> validateUser, fetchFromDB
processUser -> getUserInfo, formatOutput
```

### 预期结果

```
找到 6 个函数
processUser 调用了: getUserInfo, formatOutput
validateUser 被调用: getUserInfo
processUser 的所有依赖: getUserInfo, validateUser, checkFormat, fetchFromDB, formatOutput, JSON
缓存测试: < 5ms
```

## 性能特性

- ✅ **内存缓存**: 基于文件修改时间，避免重复解析
- ✅ **增量更新**: 只有文件修改后才重新解析
- ✅ **单例 Parser**: 共享 Parser 实例，减少初始化开销
- ✅ **精确分析**: 使用 AST 而非正则，准确识别函数作用域

## 当前限制

1. **单文件分析**: 当前只分析单个文件内的调用关系
2. **Node.js 环境**: wasm 文件在 VSCode 扩展中工作，但在纯 Node.js 脚本中需要官方 wasm
3. **临时文件**: 需要创建临时文件供分析（自动清理）

## 未来改进方向

### 1. 项目级调用图

- 跨文件分析
- 全局函数索引
- import/export 关系追踪

### 2. 持久化存储

- 将调用图保存到 JSON 或 SQLite
- 支持项目重启后快速加载
- 增量更新机制

### 3. 编译时集成

- 在编译时自动收集依赖
- 减少 Token 消耗
- 提供更精确的上下文

### 4. 可视化

- 生成调用图可视化
- 依赖关系图表
- 热点函数分析

## 相关文件

- `src/model/services/CallGraphService.ts` - 核心实现
- `src/viewmodel/roles/CompilerVM.ts` - 集成点
- `scripts/testCallGraph.ts` - 测试脚本
- `test-cases/callgraph-test.ts` - 测试用例
- `test-cases/CALLGRAPH_TEST_GUIDE.md` - 测试指南
- `parsers/*.wasm` - Tree-sitter 语言文件

## 参考资料

- [Tree-sitter 官方文档](https://tree-sitter.github.io/tree-sitter/)
- [web-tree-sitter NPM](https://www.npmjs.com/package/web-tree-sitter)
- [Tree-sitter 语言列表](https://github.com/tree-sitter)
