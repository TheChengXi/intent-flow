# DIContainer.ts

`src/adapter/mcp/DIContainer.ts`

**intent:** MCP 适配器的依赖注入容器，在 CoreDIContainer 之上注入 MCP 特定依赖（7 个 Tool + HookManager）。 屏蔽：CoreDIContainer 的实例化细节对 Tools 透明
