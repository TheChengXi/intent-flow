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

## 可用工具

| 工具名 | MCP 方法 | 对应 UseCase |
|---|---|---|
| `check_file_size` | `tools/call` | `CheckFileSizeUseCase` |
| `project_intent` | `tools/call` | `ProjectIntentUseCase` |
