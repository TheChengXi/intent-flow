# 需求文档：MCP 服务器连接稳定性（mcp-server-stability）

## 项目意图
修复 MCP 工具并行调用时的连接断开（Connection closed）问题，并消除弃用的 `Server` API，保证 stdio 协议纯净。

## 功能清单
1. **日志降噪**：data/application 层全部 `console.log`（29 处）迁移到 stderr，stdout 零日志输出
2. **SDK v2 迁移**：`@modelcontextprotocol/sdk@1.29` → `@modelcontextprotocol/server`（v2 拆分包），`MCPServer.ts` 重写为 `McpServer` + `serveStdio`
3. **Tool 类型引用统一**：`CheckFileSizeTool` 不再直接 import `data/entities` 类型，改经 UseCase re-export

## 核心功能

### 核心功能1：stdout 协议纯净性
- **能力**：系统能够保证 MCP 服务器进程中 stdout 只承载 JSON-RPC 消息，任何业务日志（缓存命中、搜索过程、LRU 淘汰等调试输出）不写入 stdout
- **业务价值**：消除客户端解析失败导致的 Connection closed，并行调用不再断开

### 核心功能2：SDK v2 服务器迁移
- **能力**：系统能够基于 `@modelcontextprotocol/server` 的 `McpServer` + `serveStdio` 启动 MCP 服务器，全部 4 个工具经 `registerTool` 注册，无弃用 API
- **业务价值**：消除 ts(6385) 弃用警告，跟上 SDK 官方演进路线；v2 对并发请求处理更稳健

### 核心功能3：Tool 类型引用统一
- **能力**：系统能够保证 MCP 适配层的 Tool 类型统一从 UseCase 文件获取，不直接引用 data 层实体
- **业务价值**：消除唯一一处跨层类型引用，类型定义位置一致，便于检索

## 业务规则

### stdout 零日志规则
- **场景**：MCP 服务器进程运行期间，任何被请求路径触发的代码执行
- **行为**：调试/统计日志一律写入 stderr（`console.error` 或等价 stderr 输出）；stdout 仅由 MCP SDK 写入 JSON-RPC 帧
- **异常处理**：若发现 stdout 出现非 JSON-RPC 内容，视为协议违规，回归测试必须失败

### 工具注册规则
- **场景**：服务器启动注册工具列表
- **行为**：全部工具经 `McpServer.registerTool(name, config, handler)` 注册；`inputSchema` 使用 zod v4 schema（现有 4 个 Tool 的手写 JSON Schema 重写为 zod）
- **异常处理**：工具不存在时返回 `isError: true` 的 MCP 错误响应（保持现状行为）

### 类型引用规则
- **场景**：adapter 层 Tool 需要输入/输出类型
- **行为**：类型从对应 UseCase 文件 import（UseCase 补充 `export type` re-export）；禁止直接 import `data/entities`
- **异常处理**：编译期检查（grep 断言），不满足则构建失败

## 预设测试

### 前置条件
- `npm run compile:mcp` 构建成功（基于 v2 SDK）
- 项目目录存在可分析的 TS 源文件（trace_dependency_chain 需要真实文件）

### 测试步骤

1. **并发压测**：写 Node 脚本，spawn MCP 服务器进程，用 `@modelcontextprotocol/client` 并发发出 6 个 `tools/call`（3× `trace_dependency_chain` + 3× `project_intent`）
   **预期结果**：6 个请求全部成功返回，无 `Connection closed`、无超时、无错误响应

2. **stdout 纯净性**：spawn 进程后捕获其 stdout 原始字节流，按 MCP stdio 帧格式（Content-Length 头）逐帧解析
   **预期结果**：所有帧均为合法 JSON-RPC 消息；日志内容（`[ASTCache]`、`[FunctionDefinitionSearcher]` 等）全部出现在 stderr 而非 stdout

3. **弃用消除**：`npx tsc --noEmit` 编译
   **预期结果**：无 ts(6385) 弃用警告；`grep -r "@modelcontextprotocol/sdk" src/` 无结果

4. **类型引用检查**：`grep "data/entities" src/adapter/mcp/tools/CheckFileSizeTool.ts`
   **预期结果**：无结果；`grep "FileSizeCheckResult" src/application/useCases/CheckFileSizeUseCase.ts` 含 `export type` re-export

5. **功能回归**：MCP 客户端调用 `project_intent`、`list_folder_intents`、`check_file_size` 各一次
   **预期结果**：返回结构与迁移前一致（JSON 序列化格式不变）

### 异常场景

- **并发下仍断开**：压测中任一请求 Connection closed → 检查是否有未迁移的 stdout 输出（stderr 侧应能捕获全部日志），定位后修复并重跑
- **inputSchema 迁移后参数不兼容**：zod schema 与旧 JSON Schema 的 required/默认值语义差异导致校验失败 → 以旧 Schema 的 properties/required 为准逐字段对齐

## 边界收束

**此时必做**：
- 29 处 `console.log` 降噪（缺少则协议污染未根治，并行断开无法修复）
- SDK v2 迁移（`Server` 已弃用，不迁移则 ts(6385) 与维护风险持续）
- CheckFileSizeTool 类型引用统一（小改动，顺带完成）

**此时不做**：
- Streamable HTTP / SSE 传输 — 当前仅本地 stdio 场景；条件：需要远程客户端访问时再引入
- v2 的完整 codemod 自动迁移 — 本项目仅 1 个文件引用 SDK，手写迁移即可，无需 codemod
- DryRunManager 跨层重构 — 已拆分为独立 feature `dryrun-use-case-extraction`

## 实现取向

- **日志降噪方式**：`console.log` → `console.error`（stderr 协议安全，改动最小）；不引入 logger 抽象层，避免过度设计。MCP 服务器入口的启动提示日志保持 `console.error`（现状已是）
- **SDK 迁移方式**：依赖变更 `@modelcontextprotocol/sdk` → `@modelcontextprotocol/server`（+ `@modelcontextprotocol/client` 作为 devDependency 供压测脚本使用）；`MCPServer.ts` 用 `McpServer` 类 + `serveStdio` 工厂方式重写，main() 入口保留
- **inputSchema 迁移方式**：4 个 Tool 的手写 JSON Schema 重写为 zod v4 schema（`zod@4.4.3` 已在依赖中）；`MCPToolDefinition.inputSchema` 类型相应调整，或 Tool 定义直接持有 zod schema
- **类型统一方式**：`CheckFileSizeUseCase.ts` 补 `export type { FileSizeCheckResult, FileSizeCheckInput }`，`CheckFileSizeTool.ts` 改 import 源
