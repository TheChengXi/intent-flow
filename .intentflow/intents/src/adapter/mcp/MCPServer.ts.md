# MCPServer.ts

`src/adapter/mcp/MCPServer.ts`

**intent:** MCP 协议适配入口，将 MCP JSON-RPC 请求分发到对应 Tool。 边界：启动时向 SDK 注册所有工具列表；每个请求通过 DIContainer 路由到具体 handler
