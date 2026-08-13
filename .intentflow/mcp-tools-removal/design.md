# 设计文档：MCP 工具移除（mcp-tools-removal）

## 0. 与需求文档的偏差（设计阶段新发现）

- **偏差**：`TraceDependencyChainUseCase.ts` 第 4 行注释写"产出 TraceDependencyChainOutput 供 TraceDependencyChainTool（Adapter/MCP）使用"——删除 MCP 工具后，该用例的消费方只剩 CLI 命令，注释指向已不存在的类。**影响**：需求文档将其标为"可选清理"，设计阶段确认**一并修正**为指向 CLI（一行注释，消除误导）。
- **偏差**：需求文档预设测试第 2 步（grep 残留）与"仅剩注释性提及"自洽，但修正上述注释后 grep 将完全干净，测试判据可从"仅剩注释"升级为"零提及"。**影响**：测试判据收紧，无行为影响。
- **偏差**：`src/adapter/mcp/README.md` 工具表仅列 `check_file_size`/`project_intent` 两行（未列将删的两个工具），**无需改动**，需求文档已正确预判。**影响**：无。
- **偏差**：`dist/mcp-server.js` 为构建产物，由 `compile:mcp` 重新生成——删除源码后**不手动删产物**，重编译自然更新；旧产物中残留已删工具是编译前瞬时态，不属本 feature 处理。**影响**：改动点清单不含 dist 产物。

## 1. 模块清单

- **[adapter/mcp/tools]**：adapter 层 — 职责：MCP 工具封装（UseCase → MCP 协议接口）— 依赖：application 层 UseCase。本次：移除 2 个工具文件 + 清理 index.ts export。
- **[adapter/mcp/DIContainer]**：adapter 层 — 职责：MCP 适配器依赖注入容器，在 CoreDIContainer 之上组装 MCP 工具 — 依赖：application/CoreDIContainer、adapter/mcp/tools。本次：移除 2 个字段/构造/列表项。
- **[adapter/mcp/MCPServer]**：adapter 层 — 职责：MCP 协议入口，registerTool 注册容器全部工具 — 依赖：adapter/mcp/DIContainer。**不动**。
- **[application/useCases]**：application 层 — 职责：业务用例编排 — 依赖：data 层仓库。**不动**（TraceDependencyChainUseCase / ListFolderIntentsUseCase 仍被 CLI 使用）。
- **[根 README.md]**：文档 — 职责：工具能力一览 — 本次：MCP 工具表删 2 行。

## 2. 最小依赖链

删除后 MCP 服务器关键路径（与删除前同构，仅工具数 4→2）：

```
MCPServer (adapter/mcp)
  → DIContainer (adapter/mcp)          [getAllTools() 返回 2 个工具]
    → CoreDIContainer (application)
      → CheckFileSizeUseCase / ProjectIntentUseCase (application)
        → data 层仓库
```

**跨层依赖体检**：
- 删除只触及 adapter/mcp 内部（tools 2 文件 + DIContainer 引用），不新增任何依赖边。
- adapter → application → data 方向保持单向，无反向依赖新增。
- 存量检查：`DIContainer.ts`（adapter）import `CoreDIContainer`（application）✅ 合法；`CoreDIContainer`（application）不依赖 adapter ✅。`Tools`（adapter）依赖 use case（application）✅。
- 未发现既有跨层依赖需要一并修复。

## 3. 测试策略

| 模块 | 验证方式 | 理由 |
|---|---|---|
| adapter/mcp/tools（删除） | 文件系统断言（文件不存在）+ grep 零提及 | 类型/肉眼可验证 |
| adapter/mcp/DIContainer | 编译期类型检查（tsc）+ 启动时 getAllTools() 数量 | 需运行时行为验证（工具注册数） |
| adapter/mcp/MCPServer | 编译 + 启动 + 工具注册清单 | 需运行时行为验证 |
| application/useCases | CLI 冒烟（trace-dependency-chain / list-folder-intents 命令） | 需运行时行为验证 |

- **依赖注入点**：无新增注入。既有模式保持——DIContainer 构造器注入 CoreDIContainer，工具构造器注入 use case（不在内部创建）。
- **验证命令**：
  - [编译]：`npm run compile:mcp` — 预期：构建成功，产出 `dist/mcp-server.js`
  - [启动]：`node dist/mcp-server.js` — 预期：输出 "IntentFlow MCP Server started (SDK v2)"
  - [工具注册]：MCP 客户端连接（或 `scripts/mcp-stress-test.mjs`）— 预期：仅 `check_file_size`、`project_intent` 两个工具
  - [CLI 回归]：`npx tsx src/adapter/cli/index.ts trace-dependency-chain --help` 与 `list-folder-intents --help` — 预期：正常输出（use case 未受删除影响）
  - [残留检查]：grep `TraceDependencyChainTool|ListFolderIntentsTool` src — 预期：零提及
- **Mock 边界**：无新增测试；本 feature 以编译 + 启动 + CLI 冒烟回归为主，不 mock（不 mock 内部协作者，CLI/MCP 均为真实调用）。

## 4. 决策记录

- **决策**：仅删除 `TraceDependencyChainTool` 与 `ListFolderIntentsTool` 两个工具文件，保留 MCP 服务器本体与其余 2 个工具。
  - **理由**：用户在需求阶段三选一明确选择"只删这两个工具文件"；备选项"删整个 adapter/mcp 文件夹"被否（MCP 服务器还要用）。
  - **影响**：`DIContainer.ts`/`tools/index.ts` 保留，仅移除相关条目；`vite.config.ts`、package.json mcp 脚本、`scripts/mcp-stress-test.mjs`、`dist` 产物全部不动。

- **决策**：一并修正 `TraceDependencyChainUseCase.ts` 第 4 行注释，消费方指向从 "TraceDependencyChainTool（Adapter/MCP）" 改为 CLI 命令。
  - **理由**：需求文档标为"可选"，设计阶段确认为低风险高收益（一行注释，消除对已删类的误导引用，使 grep 残留检查判据可收紧为零提及）。
  - **影响**：无后续模块约束。

- **决策**：不手动删除 `dist/mcp-server.js` 构建产物。
  - **理由**：产物由 `compile:mcp` 全量重建，手动删无意义且可能破坏验证顺序（先编译后启动）；旧产物残留属瞬时态。
  - **影响**：验证命令顺序固定为 compile → run。

## 5. 改动点清单

**删除文件（2）**：
- `src/adapter/mcp/tools/TraceDependencyChainTool.ts`
- `src/adapter/mcp/tools/ListFolderIntentsTool.ts`

**修改文件（4）**：
- `src/adapter/mcp/tools/index.ts` — 删 2 行 export（`TraceDependencyChainTool`、`ListFolderIntentsTool`）
- `src/adapter/mcp/DIContainer.ts` — 删 2 个 public 字段、2 段构造初始化、`getAllTools()` 数组 2 项
- `README.md` — MCP 工具表删 `trace_dependency_chain`、`list_folder_intents` 2 行
- `src/application/useCases/TraceDependencyChainUseCase.ts` — 第 4 行注释消费方改为 CLI 命令（设计阶段新增）

**新增文件**：无
