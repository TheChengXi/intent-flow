# 设计文档：MCP 服务器连接稳定性（mcp-server-stability）

## 设计基线

**项目状态**：已有项目，遵循现有三层结构（adapter → application → data），只做增量改造。

**本次设计范围**：
1. SDK v2 迁移（`@modelcontextprotocol/sdk` → `@modelcontextprotocol/server`）
2. stdout 日志降噪（data 层 29 处 console.log → console.error）
3. CheckFileSizeTool 类型引用统一

---

## 模块清单

| 模块 | 层级归属 | 职责 | 依赖 |
|---|---|---|---|
| `MCPServer`（`src/adapter/mcp/MCPServer.ts`） | adapter/mcp | v2 服务器装配：McpServer 创建、registerTool 注册全部工具、serveStdio 启动 | DIContainer、`@modelcontextprotocol/server` |
| `MCPToolHandler`（`src/adapter/mcp/MCPToolHandler.ts`） | adapter/mcp | Tool 结构接口；`MCPToolDefinition.inputSchema` 类型由手写 JSON Schema 改为 zod（`z.ZodRawShape`） | zod v4 |
| 4 个 Tool（`src/adapter/mcp/tools/*.ts`） | adapter/mcp/tools | 封装 UseCase，各自持有 zod inputSchema；执行逻辑不变 | 对应 UseCase、MCPToolHandler |
| `DIContainer`（`src/adapter/mcp/DIContainer.ts`） | adapter/mcp | Tools 装配与单例（**不改**） | CoreDIContainer |
| `CheckFileSizeUseCase`（`src/application/useCases/CheckFileSizeUseCase.ts`） | application | 新增 `export type` re-export `FileSizeCheckResult` / `FileSizeCheckInput` | — |
| data 层日志降噪（5 个文件） | data | `console.log` → `console.error`（结构、逻辑不变） | — |

**不新增业务模块**：stdout 降噪是机械替换，SDK 迁移只重写 MCPServer 一个文件，不引入新抽象。

---

## 依赖链

```
MCPServer.ts（vite 入口）                      [adapter/mcp]
  └─ serveStdio(factory)                       @modelcontextprotocol/server/stdio
       └─ McpServer.registerTool(name, {description, inputSchema}, cb)
            └─ DIContainer.getInstance().getAllTools()   [adapter/mcp, 单例]
                 └─ 4 个 Tool → UseCase                    [application]
                      └─ FileSystemRepository / CodeParserRepositoryImpl  [data]
                           └─ searchers / caches（日志已降噪）            [data]
```

关键路径（注册）：`registerTool` 从 `tool.definition` 取 `name / description / inputSchema(zod)`。
关键路径（调用）：callback 内 `tool.execute(args)`，try/catch 返回 `{ content, isError }`（保持现状错误格式）。

---

## 测试策略

| 模块 | 验证模式 | 依赖注入点 | 验证命令 |
|---|---|---|---|
| MCPServer v2 重写 | [隔离 TDD] | 进程级黑盒：压测脚本 spawn `dist/mcp-server.js`，不注入、不 mock，真实文件系统 | `node scripts/mcp-stress-test.mjs` |
| Tool zod schema 迁移 | [直接模式] | 类型系统验证（tsc）+ 压测中参数校验行为 | `npx tsc --noEmit` |
| 日志降噪 | [直接模式] | 压测脚本捕获子进程 stdout 逐帧解析 | `node scripts/mcp-stress-test.mjs` |
| CheckFileSizeTool 类型统一 | [直接模式] | grep 断言 + tsc | `grep "data/entities" src/adapter/mcp/tools/CheckFileSizeTool.ts` |

**Mock 边界**：不 mock 任何内部协作者（UseCase/Repository/缓存）。压测脚本只以进程边界为测试边界：spawn 真实服务器进程、走真实 stdio 协议、读真实文件。`@modelcontextprotocol/client` 作为 devDependency 提供客户端侧协议实现。

**新增文件 `scripts/mcp-stress-test.mjs`**（单脚本两断言）：
1. **并发断言**：`StdioClientTransport` 连接服务器 → 并发发出 6 个 `tools/call`（3× trace_dependency_chain + 3× project_intent）→ 断言全部成功返回、无 Connection closed、无 isError
2. **帧纯净断言**：捕获子进程 stdout 原始字节，按 `Content-Length` 帧格式逐帧解析 → 断言所有帧均为合法 JSON-RPC；日志文本（`[ASTCache]`、`[FunctionDefinitionSearcher]` 等）出现在 stderr 而非 stdout

**package.json 新增脚本**：`"verify:mcp": "npm run compile:mcp && node scripts/mcp-stress-test.mjs"`

---

## 本次设计决策

### 决策 1：inputSchema 从手写 JSON Schema 迁移到 zod v4
- **理由**：v2 `registerTool` 的 inputSchema 只接受 zod（ZodRawShape / ZodObject），无 JSON Schema 内建转换；项目 zod@4.4.3 已就位
- **附带收益**：v2 SDK 用 zod 校验入参，校验失败自动返回 isError 响应（旧实现无参数校验，直接透传）——行为增强，需在报告中说明
- **接口约束**：`MCPToolDefinition.inputSchema: z.ZodRawShape`（`Record<string, z.ZodType>`）；description 保留字符串

### 决策 2：serveStdio 工厂模式
- **理由**：v2 官方推荐，托管传输生命周期与 era 决策；`StdioServerTransport + connect` 手构方式仍可用但非推荐
- **形态**：`serveStdio(() => { const container = DIContainer.getInstance(); const server = new McpServer({name:'intent-flow', version:'2.0.0'}, {capabilities:{tools:{}}}); registerTools(server, container); return server; })`——DIContainer 单例共享，McpServer 每连接一个实例
- **接口约束**：`registerTool` callback 保持 try/catch → `{ content: [{type:'text', text: JSON.stringify(result, null, 2)}], isError: true }` 错误格式，与现状一致

### 决策 3：console.log → console.error 统一降噪
- **理由**：stderr 不参与 MCP stdio 协议，改动最小；不引入 logger 抽象（过度设计）
- **范围**：data 层 5 文件 29 处（ASTCache、DefinitionCache、FileContentCache、FunctionDefinitionSearcher、TypeDefinitionSearcher）；CLI 业务输出走 stdout 不受影响，日志走 stderr 是标准行为

### 决策 4：压测脚本用官方 @modelcontextprotocol/client
- **理由**：与服务器同源 SDK，协议实现一致；devDependency 不进入产物（vite external 配置不含它，但仅 scripts/ 引用，tsconfig 已 exclude scripts/）
- **版本**：v2 已恢复双格式（CJS + ESM 并存），Node 20+，兼容现有 vite cjs 构建与 `mcp:dev` ts-node 脚本

### 决策 5：CheckFileSizeTool 类型统一走 UseCase re-export
- **理由**：与其余 3 个 Tool 的取型方式对齐；`CheckFileSizeUseCase` 补 `export type {...} from '../../data/entities/FileSizeCheckResult'` 即可，不动 data 层实体

---

## 改动点清单

### 修改（8 个文件 + package.json）

| 文件 | 改动 |
|---|---|
| `package.json` | 依赖：删 `@modelcontextprotocol/sdk`，加 `@modelcontextprotocol/server`；devDependencies 加 `@modelcontextprotocol/client`；scripts 加 `verify:mcp` |
| `src/adapter/mcp/MCPServer.ts` | v2 重写：McpServer + registerTool + serveStdio 工厂；移除 Server/StdioServerTransport/RequestSchema 旧 API |
| `src/adapter/mcp/MCPToolHandler.ts` | `inputSchema` 类型：手写 JSON Schema 结构 → `z.ZodRawShape` |
| `src/adapter/mcp/tools/ProjectIntentTool.ts` | inputSchema 重写 zod（path: string, intent: string, force: boolean.optional()） |
| `src/adapter/mcp/tools/TraceDependencyChainTool.ts` | inputSchema 重写 zod（entryFile: string 必填；layerConfig 嵌套 rules 数组） |
| `src/adapter/mcp/tools/CheckFileSizeTool.ts` | inputSchema 重写 zod + import 源改 UseCase re-export |
| `src/adapter/mcp/tools/ListFolderIntentsTool.ts` | inputSchema 重写 zod |
| `src/application/useCases/CheckFileSizeUseCase.ts` | 补 `export type { FileSizeCheckResult, FileSizeCheckInput }` |
| data 层 5 文件（ASTCache / DefinitionCache / FileContentCache / FunctionDefinitionSearcher / TypeDefinitionSearcher） | 29 处 `console.log` → `console.error` |

### 新增（1 个文件）

| 文件 | 内容 |
|---|---|
| `scripts/mcp-stress-test.mjs` | 并发压测（6 并发 tools/call）+ stdout 帧纯净性断言 |

### 不改

- `DIContainer.ts`、`MCPToolHandler` 接口结构（仅类型字段变化）、UseCase 业务逻辑、data 层结构
- 构建配置（vite cjs + ts-node 均兼容 v2 双格式包）
- `mcp:dev` / `mcp` / `compile:mcp` 脚本入口不变
