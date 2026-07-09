> **⚠️ 已废除** — 本文档描述的旧 Hook 系统（MetricsHook / LoggingHook / CacheHook）已被移除或归档，不再属于活跃功能。留作历史参考。

# Hook 系统说明（已废除）

CDD Framework 早期版本使用 Hook 系统来监控和扩展核心功能。Hook 是一种事件监听机制，允许在关键操作前后插入自定义逻辑。

---

## 🎯 什么是 Hook？

Hook 是一个**观察者模式**的实现，允许你在特定事件发生时执行自定义代码，而无需修改核心逻辑。

### 类比
就像 Git 的 pre-commit hook 一样：
- Git 在提交前触发 `pre-commit` hook
- 你可以在 hook 中运行代码检查
- 如果检查失败，可以阻止提交

CDD Framework 的 Hook 类似，但用于代码分析操作。

---

## 📍 可用的 Hook 点

### 1. before_extract / after_extract
**触发时机**：提取代码上下文时

**数据**：
```typescript
// before_extract
{
  filePath: string;      // 文件路径
  startLine?: number;    // 起始行号
  endLine?: number;      // 结束行号
  depth: number;         // 依赖深度
}

// after_extract
{
  result: any;           // 提取结果
  duration: number;      // 耗时（毫秒）
  filePath: string;      // 文件路径
}
```

**用途**：
- 记录提取操作的性能
- 缓存提取结果
- 记录提取日志

---

### 2. before_search / after_search
**触发时机**：搜索函数或类型定义时

**数据**：
```typescript
// before_search
{
  name: string;          // 搜索的名称
  filePath: string;      // 文件路径
  language: string;      // 编程语言
  type: 'function' | 'type';  // 搜索类型
}

// after_search
{
  name: string;          // 搜索的名称
  filePath: string;      // 文件路径
  result: any;           // 搜索结果
  duration: number;      // 耗时（毫秒）
  found: boolean;        // 是否找到
  type: 'function' | 'type';  // 搜索类型
}
```

**用途**：
- 记录搜索性能
- 缓存搜索结果
- 统计搜索成功率

---

### 3. on_cache_hit / on_cache_miss
**触发时机**：缓存命中或未命中时

**数据**：
```typescript
{
  key: string;           // 缓存键
  type: 'file' | 'ast' | 'definition';  // 缓存类型
}
```

**用途**：
- 统计缓存命中率
- 优化缓存策略
- 监控缓存性能

---

### 4. on_file_read
**触发时机**：读取文件时

**数据**：
```typescript
{
  filePath: string;      // 文件路径
  size: number;          // 文件大小（字节）
}
```

**用途**：
- 监控文件读取
- 统计读取的文件数量
- 检测大文件读取

---

### 5. on_error
**触发时机**：发生错误时

**数据**：
```typescript
{
  error: Error;          // 错误对象
  operation: string;     // 操作名称
  input: any;            // 输入参数
}
```

**用途**：
- 记录错误日志
- 错误统计
- 错误告警

---

## 🔌 内置的 Hook 实现

### 1. MetricsHook（性能监控）

**功能**：
- 记录所有操作的耗时
- 计算 P50、P95、P99、平均值
- 统计缓存命中率
- 每 100 次操作输出一次统计

**输出示例**：
```
[MetricsHook] 提取性能统计 (100 次): {
  p50: 15ms,
  p95: 45ms,
  p99: 80ms,
  avg: 20ms
}

[MetricsHook] 缓存命中率: 75%
```

---

### 2. LoggingHook（日志记录）

**功能**：
- 记录所有操作的详细日志
- 记录错误信息
- 帮助调试和排查问题

**输出示例**：
```
[LoggingHook] before_search: 搜索函数 getUserById in src/user.ts
[LoggingHook] after_search: 找到函数 getUserById (耗时 12ms)
[LoggingHook] on_error: 搜索失败 - 文件不存在
```

---

### 3. CacheHook（缓存管理）

**功能**：
- 缓存文件内容
- 缓存 AST 解析结果
- 缓存搜索结果
- 自动失效过期缓存

**效果**：
- 第一次搜索：50ms
- 第二次搜索（缓存命中）：2ms
- 性能提升 25 倍

---

## 🔄 Hook 的执行流程

```
用户调用 MCP 工具
    ↓
触发 before_* Hook（并行执行所有注册的 Hook）
    ↓
执行核心操作
    ↓
触发 after_* Hook（并行执行所有注册的 Hook）
    ↓
返回结果
```

**重要特性**：
- Hook 并行执行，互不阻塞
- Hook 错误不会中断主流程
- Hook 错误会触发 `on_error` Hook

---

## 💡 Hook 的优势

### 1. 自动化
- 你不需要手动调用 Hook
- MCP 工具会自动触发 Hook
- 性能监控、日志记录、缓存优化都是自动的

### 2. 透明性
- Hook 不影响核心逻辑
- Hook 失败不会导致操作失败
- 可以随时添加或移除 Hook

### 3. 可扩展性
- 可以轻松添加新的 Hook 点
- 可以实现自定义 Hook
- 可以组合多个 Hook

---

## 🎓 使用建议

### 对于 Skill 开发者

**你不需要关心 Hook 的实现细节**，只需要知道：

1. **性能会被自动监控**
   - 每次调用 MCP 工具都会记录耗时
   - 可以通过日志查看性能统计

2. **结果会被自动缓存**
   - 重复调用相同的工具会更快
   - 缓存会在文件修改后自动失效

3. **错误会被自动记录**
   - 所有错误都会被记录到日志
   - 可以通过日志排查问题

### 对于框架开发者

如果你想添加新的 Hook：

1. 在 `HookTypes.ts` 中定义新的 Hook 点
2. 在相应的代码中触发 Hook
3. 实现自定义的 Hook 类

---

## 🔗 相关文档

- [MCP 工具使用指南](MCP-TOOLS.md) - 了解可用的 MCP 工具
- [工作流程](WORKFLOW.md) - 了解 CDD 的整体流程
- [术语表](GLOSSARY.md) - 了解 CDD 的术语定义
