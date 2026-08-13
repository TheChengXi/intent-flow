# 需求文档：MCP 工具移除（mcp-tools-removal）

## 项目意图

从 MCP 适配层移除 `TraceDependencyChainTool` 与 `ListFolderIntentsTool` 两个工具，保留 MCP 服务器本体及 `check_file_size`、`project_intent` 两个工具，使 MCP 服务器重启后不再暴露 `trace_dependency_chain`、`list_folder_intents` 能力。

## 功能清单

1. **删除工具文件**：删除 `src/adapter/mcp/tools/TraceDependencyChainTool.ts` 与 `src/adapter/mcp/tools/ListFolderIntentsTool.ts`
2. **引用清理**：移除 `tools/index.ts` 的 export、`DIContainer.ts` 的字段/构造/工具列表、根 `README.md` 工具表的对应行
3. **回归验证**：MCP 服务器仍可编译、可启动，剩余 2 个工具正常注册

## 核心功能

### 核心功能1：删除两个 MCP 工具
- **能力**：系统能够移除 TraceDependencyChainTool 与 ListFolderIntentsTool，使 MCP 服务器不再注册 `trace_dependency_chain`、`list_folder_intents` 两个工具
- **业务价值**：收敛 MCP 工具面，服务器能力与保留用途对齐

### 核心功能2：引用同步清理
- **能力**：系统能够清理全部引用点——`tools/index.ts` export 行、`DIContainer.ts` 中两个字段及 `getAllTools()` 数组项、根 `README.md` MCP 工具表两行
- **业务价值**：删除后仓库无悬空引用，编译与文档一致

### 核心功能3：保留面回归
- **能力**：系统能够在删除后保持 MCP 服务器可编译、可启动，`check_file_size`、`project_intent` 两个工具正常注册
- **业务价值**：证明删除零波及，MCP 服务器本体不受影响

## 业务规则

### 保留面固定
- **场景**：删除两个工具后
- **行为**：MCP 服务器（`MCPServer.ts`/`DIContainer.ts`/`vite.config.ts` 入口/package.json mcp 脚本/`scripts/mcp-stress-test.mjs`）全部保留，仅 `getAllTools()` 返回 2 个工具
- **异常处理**：若发现服务器启动失败 → 检查 DIContainer 构造是否残留对已删类的引用，先恢复引用再排查

### 依赖层不动
- **场景**：MCP 工具依赖的 application 层用例（`TraceDependencyChainUseCase`、`ListFolderIntentsUseCase`）
- **行为**：两个 use case 保留——CLI 命令（`TraceDependencyChainCommand`、`ListFolderIntentsCommand`）仍经 CliDIContainer 使用
- **异常处理**：无

### 文档同步
- **场景**：根 `README.md` "MCP 工具" 表
- **行为**：删除 `trace_dependency_chain`、`list_folder_intents` 两行；`src/adapter/mcp/README.md` 工具表（仅含 check_file_size/project_intent）无需改动
- **异常处理**：无

## 预设测试

> 从用户视角可执行的测试步骤，验证功能是否符合预期。

### 前置条件
- 依赖已安装；删除前 `npm run compile:mcp` 可构建、`node dist/mcp-server.js` 可启动

### 测试步骤

1. **[文件删除]**：检查 `src/adapter/mcp/tools/` 目录
   **预期结果**：`TraceDependencyChainTool.ts`、`ListFolderIntentsTool.ts` 不存在；`CheckFileSizeTool.ts`、`ProjectIntentTool.ts` 仍在

2. **[引用清理]**：grep `TraceDependencyChainTool|ListFolderIntentsTool` 于 src 目录
   **预期结果**：仅剩注释性提及（如 use case 内"供 Adapter/MCP 使用"的注释），无实际 import/export/实例化引用

3. **[MCP 编译]**：运行 `npm run compile:mcp`
   **预期结果**：构建成功，产出 `dist/mcp-server.js`

4. **[MCP 启动]**：运行 `node dist/mcp-server.js`（stdio 模式，观察启动日志）
   **预期结果**：正常输出 "IntentFlow MCP Server started"，无残留工具引用报错

5. **[工具注册]**：以 MCP 客户端连接（如 `scripts/mcp-stress-test.mjs`）
   **预期结果**：仅暴露 `check_file_size`、`project_intent` 两个工具

6. **[CLI 回归]**：运行 `npx tsx src/adapter/cli/index.ts trace-dependency-chain --help` 与 `list-folder-intents --help`
   **预期结果**：CLI 命令正常（依赖的 use case 未受删除影响）

### 异常场景

- **[残留引用]**：编译报错提示找不到 TraceDependencyChainTool → 检查 `tools/index.ts`、`DIContainer.ts` 是否未清理干净
- **[文档遗漏]**：README 工具表仍含已删工具 → 补删对应行

## 边界收束

**此时必做**：
- 删除 2 个工具文件
- 清理 3 处引用（tools/index.ts、DIContainer.ts、根 README.md）
- 回归：compile:mcp + 启动 + CLI 冒烟

**此时不做**：
- 删除 MCP 服务器本体（`MCPServer.ts`/`DIContainer.ts`/`vite.config.ts` 入口/package.json 脚本）— 用户明确保留 MCP 服务器，仅移除这两个工具
- 删除 application 层两个 use case — CLI 命令仍在使用
- 清理 `scripts/mcp-stress-test.mjs`、`dist/mcp-server.js` — 服务器保留，压测脚本与产物继续有效
- 移除 `check_file_size`、`project_intent` 两个工具 — 超出本 feature 对象

## 实现对齐

- **[删除工具]**：直接删除 `src/adapter/mcp/tools/TraceDependencyChainTool.ts`、`src/adapter/mcp/tools/ListFolderIntentsTool.ts` 两个文件
- **[引用清理]**：编辑 `src/adapter/mcp/tools/index.ts`（移除 2 行 export）→ 编辑 `src/adapter/mcp/DIContainer.ts`（移除 2 个字段、构造初始化、`getAllTools()` 数组 2 项）→ 编辑根 `README.md`（移除工具表 2 行）
- **推导出的约束**：MCP 服务器与 CLI 均依赖 application 层用例，删除只触及 MCP 工具封装层，用例层必须保留（已确认）；当前会话的 `mcp__intent-flow__*` 工具由本项目 MCP 服务器提供，删除后重启服务器这两个工具将消失（已确认接受）
- **design 决策**：无（方案已由用户确认：仅删两个工具文件，非删整个适配层）
