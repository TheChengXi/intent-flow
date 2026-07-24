# MCP 适配层

MCP（Model Context Protocol）服务器适配层。将 CoreDIContainer 的 UseCase 封装为 MCP 工具，
供支持 MCP 协议的客户端（Claude Desktop、Claude Code 等）调用。

## 快速开始

```bash
npm run compile:mcp       # 构建到 dist/mcp-server.js
node dist/mcp-server.js   # 启动 MCP 服务器（stdio 传输）
```

## 入口

`src/adapter/mcp/index.ts` — 导出 `MCPServer`、`MCPToolHandler`、`DIContainer`。

编译由根目录 `vite.config.ts` 统一处理，三个入口同时输出。

## 可用工具

| 工具名 | MCP 方法 | 对应 UseCase |
|---|---|---|
| `check_file_size` | `tools/call` | `CheckFileSizeUseCase` |
| `trace_dependency_chain` | `tools/call` | `TraceDependencyChainUseCase` |
| `project_intent` | `tools/call` | `ProjectIntentUseCase` |

## 添加新工具

1. 在 `dto/input/` 添加输入类型
2. 在 `tools/` 下新建 `XxxTool.ts`，实现 `MCPTool` 接口
3. 在 `tools/index.ts` 注册
4. 在 `DIContainer.ts` 注入对应的 UseCase

## 注意

- 传输方式：stdio（标准输入/输出）
- HookManager（缓存、日志、指标）仅在此层初始化，CLI 和 VSCode 适配层不加载
