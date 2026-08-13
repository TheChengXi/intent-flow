# 设计文档：pi-removal

> 已有项目 — 顺应原有分层（data → application → adapter：CLI / MCP），本次为纯删除/归档，无新增模块。

## 0. 与需求文档的偏差（设计阶段新发现）

- **偏差**：`scripts/deploy-pi.js` 实际**未被 git 跟踪**（`.gitignore` 中 `scripts/*` 全忽略 + `!scripts/fetch-release.js` 白名单），而 `scripts/fetch-release.js` 被跟踪 — **影响**：deploy-pi.js 不能用 git mv，需普通 move；入档到 `.archive/` 后（该目录未被忽略）它会被 git 识别为新跟踪文件，符合归档语义；fetch-release.js 用 git mv 保留历史。
- **偏差**：`package.json` 中还有 `"fetch-release": "node scripts/fetch-release.js"` script（需求文档只列了 compile:pi/deploy:pi）— **影响**：一并删除。
- **偏差**：`typebox` 在 `dependencies`（顶层），同时以 `piProvidedPackages` 出现在 vite.config（pi 运行时提供，不打进产物）— **影响**：移除依赖需同步 package-lock.json，采用 `npm uninstall` 自动重算 lock，不手编 lock。
- **偏差**：README 的 `.pi/skills/...` 技能路径实际早已失效——仓库内技能现位于 `.dsh/skills/`（skill base = `D:\w_dev\intent-flow\.dsh\skills\`）— **影响**：README 清理将 `.pi/skills/...` 改指 `.dsh/skills/...`，而非删除。
- **偏差**：`.gitignore` 的 `!scripts/fetch-release.js` 白名单行随脚本废弃变为死配置 — **影响**：删除该行（`scripts/*` 忽略规则保留，`scripts/mcp-stress-test.mjs` 等本地脚本依旧不入库）。
- **偏差**：`.archive/retired_pi.008/` 已含 `pi/`（`.pi` 运行时配置）— **影响**：本次归档落在 `adapter/`、`application/`、`data/`、`scripts/` 子路径下，与既有 `pi/` 无冲突，仅追加。

## 1. 模块清单

本次无新增模块，改动均为既有模块内的删除/归档。涉及模块：

- **[adapter/pi]**：adapter 层 — 职责：pi 扩展形态（入口/DI/TUI/工具/命令/运行时）— 依赖：application 层 pi 独占组件 + `@earendil-works/pi-*` — **整目录入档，删除**
- **[adapter/mcp]**：adapter 层 — 职责：MCP 服务器（2 工具）— 依赖：CoreDIContainer — **保留不动**（不引用任何 pi 独占组件，已验证）
- **[adapter/cli]**：adapter 层 — 职责：CLI 命令（4 条）— 依赖：CoreDIContainer — **保留不动**（不引用任何 pi 独占组件，已验证）
- **[application/CoreDIContainer]**：application 层 — 职责：共享依赖组装 — 依赖：data 层 — **剪掉 agentRepo/guardToggleStore/guardToggleService 死接线**
- **[application/useCases]**：application 层 — 职责：用例 — **移除 DiscoverAgentsUseCase、AgentRequestUseCase（+测试）**
- **[application/services]**：application 层 — 职责：服务接口/实现 — **移除 ScopePolicy、IAccessPolicyService、IGuardToggleService、GuardToggleService（+测试）、IAgentMessagingService、agentRepository 透出**
- **[data/repositories / data/services / data/entities]**：data 层 — 职责：接口/实现/实体 — **移除 agent 域（IAgentRepository、AgentRepositoryImpl、GuardToggleStore、scope 策略、AgentDefinition/AgentRunResult/AgentUsage）**

## 2. 最小依赖链

归档后的剩余关键路径（验证 pi 移除不影响 CLI/MCP 主链路）：

```
adapter/mcp/DIContainer ──→ CoreDIContainer ──→ data/repositories（IFile/ICodeParser/ICache）
adapter/cli/CliDIContainer ─┘        │             data/services（fileSystem/cache/codeParser/tree-sitter）
                                      └─→ useCases（checkFileSize/traceDependencyChain/projectIntent/listFolderIntents）
```

**跨层依赖体检**：
- 移除后 application 不再依赖 `data/services/agent|guard|scope`、`data/repositories/IAgentRepository`、`data/entities/Agent*` — 原有"adapter 不直接 import data"约束保持。
- 无反向依赖引入：本次无新增依赖，只做删除。
- 既有跨层依赖问题：无（需求/设计阶段逐文件 grep 已确认 CLI/MCP 不触碰 pi 独占组件）。

## 3. 测试策略

### 验证方式

- **归档完整性**：肉眼/文件系统核对 — 理由：`.archive/retired_pi.008/` 下结构需与源路径一一对应（adapter/pi、application/useCases|services、data/repositories|services|entities、scripts/deploy-pi.js、scripts/fetch-release.js）
- **零残留**：grep 静态验证 — 理由：类型可验证，无需运行时
- **构建/运行**：compile + MCP 注册 + verify:mcp + CLI 冒烟 — 理由：需运行时行为验证（vite 打包、MCP 帧协议、进程池压测）
- **测试套件**：`npx vitest run` ×3 — 理由：需运行时行为验证；pi 测试随目录移出 `src/**` 后自动不参与（vitest include = `src/**/*.test.ts`）

### 依赖注入点

本次无新增注入点。删除后注入面变化：
- `CoreDIContainer` 构造器：移除 `new AgentRepositoryImpl()`、`new GuardToggleStore()`、`new GuardToggleService(store)`（这些原本就在 CoreDIContainer 内部创建，现整体删除）
- 无其他注入点改动

### 验证命令

| 验证项 | 命令 | 预期 |
|---|---|---|
| 残留检查 | grep `DiscoverAgentsUseCase|AgentRequestUseCase|ScopePolicy|IAccessPolicyService|IGuardToggleService|GuardToggleService|IAgentMessagingService|agentRepository|AgentRepositoryImpl|GuardToggleStore|IAgentRepository|AgentDefinition|AgentRunResult|AgentUsage|data/services/scope|PI_EXT_SKIP|pi/extension|deploy-pi|compile:pi|pi-coding-agent|pi-tui|adapter/pi`（范围 `src/`、`scripts/`、`vite.config.ts`、`package.json`、`README.md`） | 零匹配（`.archive/` 与 `.dsh/` 不扫） |
| MCP 构建 | `npm run compile:mcp` | 成功产出 `dist/mcp-server.js` |
| CLI 构建 | `npm run compile:cli` | 成功产出 `dist/cli/iflow.js` |
| MCP 注册 | 启动 `node dist/mcp-server.js` | 工具 = `["check_file_size","project_intent"]` |
| MCP 压测 | `npm run verify:mcp` | 全绿 |
| CLI 冒烟 | `node dist/cli/iflow.js <cmd> --help`（4 命令） | 均输出 usage |
| 测试套件 | `npx vitest run` ×3 | 3 次全绿 |

### Mock 边界

不新增 mock。pi 相关测试整体入档，不再运行。保留套件（AgentRequestUseCase.test/GuardToggleService.test 等）随源文件入档。

## 4. 决策记录

- **决策**：整目录 `git mv` 归档（`src/adapter/pi` 全目录、application/data 独占文件、`scripts/fetch-release.js` 用 git mv；`scripts/deploy-pi.js` 因未被跟踪用普通 move）
  - **理由**：归档是仓库既有惯例（retired-*.00N 均为移动而非复制），git mv 保留文件历史；deploy-pi.js 无历史可保留。对比过"复制+删除"——会导致 archive 与 src 双份，违背归档语义。
  - **影响**：`.archive/` 下文件全部进入版本库；deploy-pi.js 从"忽略"变为"跟踪"，符合"退役代码入档"意图。
- **决策**：依赖移除用 `npm uninstall @earendil-works/pi-coding-agent @earendil-works/pi-tui typebox` 自动同步 package.json + package-lock.json
  - **理由**：package-lock.json 中 `@earendil-works/pi-coding-agent` 子树含 100+ 传递依赖，手编 lock 极易出错。npm uninstall 移除操作为本地操作（无需网络），自动重算 lock。
  - **影响**：需一次 danger-full-access 权限（sandbox 下 npm spawn 受限，与既往 compile/vitest 相同）。
- **决策**：README 中 `.pi/skills/...` 改指 `.dsh/skills/...`，删除 "Pi Agent 集成" 小节与 Loop 状态机插件段落
  - **理由**：技能实际位于 `.dsh/skills/`（已核实），指向失实路径比删除更误导；Loop/init_feature 插件随 pi 扩展入档，其"状态机自动推进"机制在当前形态（CLI+MCP+工作流）下无宿主，整段删除而非改写。
  - **影响**：README 描述与"CLI + MCP + 工作流三件套"现状一致。
- **决策**：`CoreDIContainer` 直接删除 agentRepo/guardToggleStore/guardToggleService 字段与初始化，不做"保留备用"
  - **理由**：三个字段仅 pi 消费（mcp/cli 容器只访问 checkFileSize/traceDependencyChain/projectIntent/listFolderIntents 用例，已逐文件核实）；"不兜底哲学"——不存在确定路径的代码不留。
  - **影响**：若未来某适配器需要 agent 发现/守卫开关，需从 archive 重新提取（later-on L02 记录）。
- **决策**：`.gitignore` 删除 `!scripts/fetch-release.js` 白名单行
  - **理由**：白名单唯一服务对象已废弃，删行消除死配置；`scripts/*` 忽略规则保留（本地脚本不入库是仓库现状）。
  - **影响**：`scripts/` 目录无任何被跟踪文件（现状延续，无行为变化）。

## 5. 改动点清单

### 移入 `.archive/retired_pi.008/`（git mv，deploy-pi.js 用 move）

- `src/adapter/pi/` 整目录（24 文件）→ `adapter/pi/`
- `src/application/useCases/DiscoverAgentsUseCase.ts`、`AgentRequestUseCase.ts`、`AgentRequestUseCase.test.ts` → `application/useCases/`
- `src/application/services/ScopePolicy.ts`、`IAccessPolicyService.ts`、`IGuardToggleService.ts`、`GuardToggleService.ts`、`GuardToggleService.test.ts`、`IAgentMessagingService.ts`、`agentRepository.ts` → `application/services/`
- `src/data/services/agent/AgentRepositoryImpl.ts`、`AgentRepositoryImpl.test.ts` → `data/services/agent/`
- `src/data/services/guard/GuardToggleStore.ts`、`GuardToggleStore.test.ts` → `data/services/guard/`
- `src/data/services/scope/`（IAccessPolicy.ts、policy.ts、index.ts）→ `data/services/scope/`
- `src/data/repositories/IAgentRepository.ts` → `data/repositories/`
- `src/data/entities/AgentDefinition.ts`、`AgentRunResult.ts`、`AgentUsage.ts` → `data/entities/`
- `scripts/deploy-pi.js`（move）、`scripts/fetch-release.js`（git mv）→ `scripts/`

### 编辑（清理引用）

- `src/application/CoreDIContainer.ts`：删 agentRepo/guardToggleStore/guardToggleService 字段、import、构造初始化；更新 @intent
- `src/application/useCases/index.ts`：删 DiscoverAgentsUseCase/AgentRequestUseCase 两行 export
- `src/data/repositories/index.ts`：删 IAgentRepository export
- `src/data/entities/index.ts`：删 AgentDefinition/AgentRunResult/AgentUsage 三行 export
- `vite.config.ts`：删 `pi/extension` 入口、`piProvidedPackages` 数组、`outFileName` 的 pi 分支、头部注释中的 pi 行
- `package.json`：`compile` 改 `compile:mcp && compile:cli`；删 `compile:pi`、`deploy:pi`、`fetch-release` scripts；删 devDeps `@earendil-works/pi-coding-agent`、`@earendil-works/pi-tui`；删 dep `typebox`
- `package-lock.json`：经 `npm uninstall` 自动重算
- `README.md`：`.pi/...` 引用改指 `.dsh/skills/...`；删 "Pi Agent 集成" 小节、Loop 状态机插件段落、项目结构中的 `.pi/` 行、Skill 质量标准引用改指 `.dsh/skill-standards-ref.md`（若不存在则删引用）；第 7 行补充 pi 扩展形态已移除
- `.gitignore`：删 `!scripts/fetch-release.js` 白名单行

### 删除（本地陈旧产物，不入 commit）

- `dist/pi/`（extension.js + map，构建产物，dist/ 已被 gitignore）

### 新增文件

- 无源码新增；`.intentflow/pi-removal/` 文档（requirement.md 已有，design.md、later-on.md 本次产出）
