# 后续想法备忘：MCP 工具移除（mcp-tools-removal）

### 想法列表

- **L01**：整体移除 MCP 适配层（`src/adapter/mcp` 全目录）
  - 现状：本次仅移除 2 个工具，服务器本体 + `check_file_size`/`project_intent` 保留
  - 何时做：若 MCP 消费场景（Claude Desktop/Claude Code 等）不再需要，或能力全部收敛到 CLI/其他适配层
  - 备注：届时需连带清理 vite.config.ts mcp-server 入口、package.json mcp/mcp:dev/compile:mcp/verify:mcp 脚本、scripts/mcp-stress-test.mjs、README MCP 工具表、dist 产物

- **L02**：`check_file_size` / `project_intent` 两个工具的 MCP 封装与 CLI 命令职责重叠
  - 现状：同一 UseCase 被 MCP 工具与 CLI 命令双重封装，本次删除后此模式仍在
  - 何时做：出现第三个适配层（如 Pi 已有类似工具）时，可评估统一"适配器注册表"而非每层各封装
  - 备注：属于架构演进方向，非本次范围

- **L03**：MCP 工具注册改为从 `tools/` 目录自动发现
  - 现状：`DIContainer.getAllTools()` 手工枚举 4 个工具，本次删除后为 2 个，需手工维护列表
  - 何时做：工具数量再增长、或频繁增删时
  - 备注：`MCPServer.registerTools` 已遍历容器列表，改自动发现只动 DIContainer 一处

### 与当前设计的关系（轻量提示）

- L01 影响的是保留面（本次明确不动），当前设计无需预留，届时整目录删除即可。
- L02/L03 均只影响 adapter/mcp 内部实现，当前接口（`MCPToolHandler`、`getAllTools()`）无需提前抽象，届时直接改造。
