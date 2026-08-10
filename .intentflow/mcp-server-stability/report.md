# mcp-server-stability 关账报告

## 1. 项目概览
修复 MCP 工具并行调用时的连接断开（Connection closed）与弃用 API：SDK v1 → v2 迁移（`@modelcontextprotocol/server`）、data 层 29 处 `console.log` 降噪到 stderr、CheckFileSizeTool 类型引用统一，并交付并发压测脚本验证。

## 2. 计划 vs 实际

| 计划功能 | 状态 | 说明 |
|---|---|---|
| SDK v2 迁移（McpServer + serveStdio + registerTool） | ✅ 完成 | MCPServer.ts 重写；4 工具经 registerTool 注册；无弃用 API |
| inputSchema 迁移 zod v4 | ✅ 完成 | MCPToolHandler + 4 Tool 全部 z.object() 形式 |
| 日志降噪（29 处 console.log → console.error） | ✅ 完成 | data 层 5 文件；src 全量 0 处 console.log |
| CheckFileSizeTool 类型统一（UseCase re-export） | ✅ 完成 | CheckFileSizeUseCase 补 export type，Tool 改 import 源 |
| 并发压测脚本（6 并发 + stdout 帧纯净） | ✅ 完成 | scripts/mcp-stress-test.mjs，17 项断言全过 |
| vite 构建兼容 v2 包 | ✅ 完成 | external 修正后 compile:mcp/cli/vscode 全通 |
| mcp:dev（ts-node）可用 | 🔸 部分 | ts-node 报既有 picomatch 类型错误（非本 feature 引入，见决策 4） |

## 3. 关键决策

1. **inputSchema 用 `z.object()` 而非 ZodRawShape**：实现时发现 v2 的 ZodRawShape 重载**同样被 @deprecated**（"Wrap with z.object({...}) instead"）。若按 design.md 原方案（ZodRawShape）会重新引入弃用警告，违背 feature 目标。修正：MCPToolDefinition.inputSchema 类型为 `ZodObject<ZodRawShape>`，4 个 Tool 用 z.object({...}) 包裹。
2. **vite 必须 external `@modelcontextprotocol/*`**（重大踩坑）：vite 默认 resolve 条件含 browser，打包时把 SDK 的 shims 子路径解析为 browser 版 → `StdioServerTransport` 的 `process.stdin` 变成 notSupported stub，**运行时即抛错**（"Use StreamableHTTPServerTransport instead"）。修复：rollupOptions.external 加正则 `/^@modelcontextprotocol\//`（顶层包 external 不够，子路径需正则）。
3. **v2 stdio 帧格式是 JSON Lines 而非 Content-Length 帧**：`serializeMessage = JSON.stringify(msg) + "\n"`。压测脚本阶段 A 最初按 v1 格式手写帧导致服务器无响应；改为按行解析后通过。这是 v1→v2 的协议级行为变化，官方 client 封装后无感。
4. **业务日志 stderr 断言放宽为确定性事实**：原设计断言 `[FunctionDefinitionSearcher]` 必然出现在 stderr，实际该日志触发依赖 tree-sitter 失败（wasm 加载偶发竞态，debug 时有时无）。修正：核心断言为 stdout 纯净（JSON Lines 逐行解析 + 0 残留——任何 console.log 污染必然失败）+ stderr 管道工作（启动日志）。业务日志的 stderr 归属由源码审查（console.warn/error）佐证。
5. **顺带发现未修（记录）**：① mcp:dev 的 ts-node 报 `ProjectIntentsToFilesUseCase` 的 picomatch TS7016——既有问题（文件未改、tsc/vite/vitest 全通，仅 ts-node 类型检查受影响）；② tree-sitter wasm "Incompatible language version 0" 偶发错误（降级正则仍正常工作）——与本次 feature 无关，均记入 later-on。

## 4. 经验记录

- **有效做法**：进程级黑盒压测（spawn 真实服务器 + 官方 client 并发 + 手动帧解析）同时覆盖"协议纯净性"与"并发稳定性"两个验收点；压测脚本作为 `verify:mcp` 纳入 npm scripts，可重复执行。
- **踩坑**：v2 SDK 拆分包的环境 shims 机制——打包工具（vite/rollup）解析 exports 的 browser 条件时会静默选中 browser 版 shims，**运行时才暴露**（构造即抛错）。任何打包 MCP SDK 的项目都必须 external 或显式 node 条件。
- **工具反馈**：sub-agent 通道仍不可用（同 dryrun feature），主会话代写 logs 报告。npm 依赖变更（uninstall/install）会连带重写 package-lock（含未提交的 pi 版本升级），需在报告中注明。

## 5. 后续待办

- **立即跟进**：
  - `mcp:dev` 脚本修复（ProjectIntentsToFilesUseCase 补 picomatch 类型声明或 ts-node 加 `--transpile-only`）
- **长期备忘**（见 `D:/w_dev/intent-flow/.intentflow/mcp-server-stability/later-on.md`）：
  - Streamable HTTP / serveHttp 远程部署（工厂函数可复用）
  - 缓存日志条件开关（IFLOW_DEBUG）
  - zod 校验错误定制
  - MCP vitest 单测（in-memory 传输）
  - v2 codemod（引用点增多时）

## 6. 开发工作流反馈

- **流程断点**：execute skill 的"隔离 TDD → 子 agent"通道不可用（list_agents 空），本 feature 的压测验证（本质是黑盒 TDD）由主会话完成，logs 报告代写。建议排查 sub-agent 注册机制或明确降级路径。
- **工具链建议**：v2 的 JSON Lines 帧格式与 v1 Content-Length 差异是隐藏破坏点，建议压测脚本保留"手动帧解析"模式（不依赖官方 client），作为协议格式的回归哨兵。

## 7. 结论

- **当前状态**：✅ 可发布。验证证据：tsc 0 错误；vitest 138 测试 ×3 循环稳定；压测 17 项断言全过（含 6 并发无断开、stdout 零残留）；compile:mcp/cli/vscode 构建全通；src 无 console.log 污染；无 @modelcontextprotocol/sdk 引用。
- **建议下一步**：真实客户端（Claude Code/Claude Desktop）实测并行调用；修复 mcp:dev 的 picomatch 类型错误（小改，独立处理）。
