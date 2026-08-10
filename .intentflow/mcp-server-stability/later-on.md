# 后续想法：mcp-server-stability

本文件记录本次设计范围内**明确不做**、但值得跟踪的后续想法。每一项标注触发条件，条件满足前不进入任何迭代。

---

## 1. Streamable HTTP / serveHttp 远程部署
- **想法**：v2 提供 `serveHttp` / `serveStdio` 双模式，未来若需远程客户端（多机协作、CI 服务器）访问 MCP 工具，可加 HTTP 入口
- **触发条件**：出现远程访问需求时；届时工厂函数（本次 serveStdio 工厂）可直接复用，改入口即可
- **现状**：本地 stdio 场景已覆盖，不做

## 2. 缓存日志条件开关（IFLOW_DEBUG）
- **想法**：本次统一 console.log → console.error 是"静音"处理。若调试时需要按需看到缓存命中/淘汰日志，可加环境变量开关（如 `IFLOW_DEBUG=1` 时输出），避免永久刷屏
- **触发条件**：data 层日志噪音影响日常调试（stderr 被刷爆）时；或需要诊断缓存问题时
- **现状**：29 处日志全部走 stderr，协议已安全，不做开关

## 3. zod 校验错误定制
- **想法**：v2 用 zod 校验入参，默认校验错误为英文 SDK 文案。可自定义错误消息（`z.string({ message: '...' })` 或错误映射），让客户端收到的参数错误更友好
- **触发条件**：真实客户端（Claude Code 等）反馈参数错误提示不可读时
- **现状**：旧实现无参数校验，本次获得校验能力已是增强，先不做定制

## 4. MCP 服务器 vitest 单测（in-memory 传输）
- **想法**：本次压测是进程级黑盒（spawn + 真实 stdio）。后续可引入 vitest + `@modelcontextprotocol/client` 直连（不 spawn 进程），把工具注册/错误分支做成可重复的单测
- **触发条件**：MCP 工具数量增长（>10 个）或错误处理分支复杂化时
- **现状**：4 个工具，黑盒压测足够

## 5. v2 codemod 批量迁移
- **想法**：官方提供 `npx @modelcontextprotocol/codemod@latest v1-to-v2`，本次仅 1 个文件引用 SDK 故手写迁移。未来若有其他代码引入 SDK（如客户端工具、测试辅助），可先跑 codemod 再手改
- **触发条件**：仓库内 `@modelcontextprotocol/*` 引用点 > 3 处时
- **现状**：仅 MCPServer.ts 一处

## 6. Tool schema 动态化评估
- **想法**：zod v4 的 `z.raw()` 支持任意 JSON Schema 透传。若未来有工具需要运行时动态生成 inputSchema（如 layerConfig 规则由用户配置驱动），可评估 `z.raw()` 或动态 zod 构建
- **触发条件**：出现动态 schema 需求时
- **现状**：4 个工具均为静态 schema，静态 zod 足够

---

## 实现阶段补充（以下来自 execute 阶段发现，非 design 阶段）

## 7. mcp:dev 的 ts-node 类型错误修复
- **想法**：`npm run mcp:dev`（ts-node 直接跑 MCPServer.ts）报 `ProjectIntentsToFilesUseCase.ts(12,23): TS7016: Could not find a declaration file for module 'picomatch'`。文件为既有代码（非本 feature 引入），tsc/vite/vitest 均正常，仅 ts-node 全量类型检查受影响。修复二选一：补 `@types/picomatch`（或项目内 .d.ts 声明）或 mcp:dev 脚本加 `--transpile-only`
- **触发条件**：需要 ts-node 开发调试 MCP 时（当前可用 `npm run mcp` 跑构建产物替代）
- **现状**：不影响交付，构建产物路径完全可用

## 8. tree-sitter wasm 版本兼容问题
- **想法**：并发调用时偶发 `Incompatible language version 0. Compatibility range 13 through 15`（tree-sitter wasm 语言版本不匹配），ImportExtractor 降级正则仍返回成功结果。可能是 @vscode/tree-sitter-wasm 与 tree-sitter 运行时版本不匹配（依赖 hoisting 变化触发）
- **触发条件**：trace_dependency_chain 结果精度依赖 AST 解析时（正则降级会漏解析部分语法）
- **现状**：降级路径保证功能可用，错误仅偶发且被捕获；建议在 tree-sitter 升级/重构时统一验证 wasm 版本

## 9. 压测脚本的协议格式哨兵
- **想法**：阶段 A 的手动 JSON Lines 解析器是 v1→v2 协议格式变化的"回归哨兵"。若未来 SDK 再次变更帧格式（或引入 Content-Type 头等），阶段 A 会立即失败。建议保留该模式并纳入 verify:mcp
- **触发条件**：SDK 升级时
- **现状**：已作为 verify:mcp 的一部分

## 10. package.json 环境变更耦合
- **想法**：本次依赖变更（sdk→server/client）与 pi 版本升级（0.82.1→0.84.1，此前未提交的环境变更）耦合在同一 package.json/lock 提交中。后续 feature 应避免在未提交环境变更的基础上做依赖操作，或先单独提交环境变更
- **触发条件**：下次涉及依赖安装的 feature 时
- **现状**：已在关账报告中注明，无功能影响
