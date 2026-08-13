# 需求文档：pi-removal

## 项目意图
废弃 pi 适配层（`src/adapter/pi` 全目录 + `scripts/deploy-pi.js` + `scripts/fetch-release.js`），连同其独占的 application/data 层组件与测试一并移入 `.archive/retired_pi.008/`，清理构建、依赖与 README 引用，使项目收敛为 CLI + MCP 两种适配形态。

## 功能清单
1. **pi 适配层入档**：`src/adapter/pi/`（24 个文件，含 3 个测试）→ `.archive/retired_pi.008/adapter/pi/`
2. **部署脚本入档**：`scripts/deploy-pi.js` → `.archive/retired_pi.008/scripts/`
3. **Release 脚本入档**：`scripts/fetch-release.js` → `.archive/retired_pi.008/scripts/`
4. **application 层 pi 独占组件入档**：DiscoverAgentsUseCase、AgentRequestUseCase（+ 测试）、ScopePolicy、IAccessPolicyService、IGuardToggleService、GuardToggleService（+ 测试）、IAgentMessagingService、agentRepository 透出
5. **data 层 pi 独占组件入档**：AgentRepositoryImpl（+ 测试）、GuardToggleStore（+ 测试）、IAgentRepository、AgentDefinition / AgentRunResult / AgentUsage 实体、data/services/scope（IAccessPolicy/policy/index）
6. **接线清理**：CoreDIContainer 移除 agentRepo/guardToggleStore/guardToggleService 及对应 import；useCases/repositories/entities 索引移除 pi 项
7. **构建与依赖清理**：vite.config.ts 移除 `pi/extension` 入口与 piProvidedPackages；package.json 移除 compile:pi/deploy:pi、`@earendil-works/pi-coding-agent`/`@earendil-works/pi-tui` devDeps、`typebox` dep（仅 pi 使用）
8. **README 清理**：`.pi/...` 引用改指 `.dsh/skills/...`，删除 "Pi Agent 集成" 小节、Loop 状态机插件说明、项目结构中的 `.pi/` 行

## 核心功能

### 核心功能1：pi 适配层整体入档
- **能力**：系统能够将 `src/adapter/pi` 全目录与 `scripts/deploy-pi.js`、`scripts/fetch-release.js` 移入 `.archive/retired_pi.008/`，且按仓库既有归档惯例保持 `src/` 相对路径（adapter/pi、application/…、data/…、scripts/…）
- **业务价值**：pi 扩展形态正式退出，代码库中不再存在 pi 平台依赖（`@earendil-works/pi-*`）

### 核心功能2：pi 独占依赖链完全清理
- **能力**：系统能够将 pi 适配层独占的 application/data 组件（用例、服务、仓库、实体、scope/guard 策略）与其测试一并入档，并剪除 CoreDIContainer 死接线与各层索引出口的 pi 项
- **业务价值**：不残留死代码，CLI/MCP 两个适配形态经 `npx vitest run`、`compile:mcp`、`compile:cli` 验证不受影响

### 核心功能3：构建/依赖/文档面同步
- **能力**：系统能够更新 vite.config.ts（移除 pi 入口与 piProvidedPackages）、package.json（移除 pi 相关 scripts 与依赖）、README.md（`.pi/...` → `.dsh/skills/...`，删除 pi 专属段落）
- **业务价值**：`npm run compile` 不再触碰 pi，README 与"CLI + MCP"现状一致

## 业务规则

### 归档路径规则
- **场景**：任何 pi 相关文件入档时
- **行为**：`src/adapter/pi/**` → `.archive/retired_pi.008/adapter/pi/**`；`src/application/...` → `.archive/retired_pi.008/application/...`；`src/data/...` → `.archive/retired_pi.008/data/...`；`scripts/deploy-pi.js`、`scripts/fetch-release.js` → `.archive/retired_pi.008/scripts/`
- **异常处理**：`.archive/retired_pi.008/` 已存在（含已入档的 `.pi/` 运行时配置，提交 501bda86），本次在其下追加，不覆盖既有内容

### 保留面规则
- **场景**：判断哪些组件可入档时
- **行为**：仅 pi 适配层独占、CLI/MCP 均无引用的组件入档；CLI/MCP 共享组件（CoreDIContainer、checkFileSize/traceDependencyChain/projectIntent/listFolderIntents 用例、FileSystemRepository、CacheRepositoryImpl、CodeParserRepositoryImpl、IFileRepository/ICodeParserRepository/ICacheRepository、FileSizeCheckResult/FunctionDefinition/TypeDefinition/CacheStats 实体）保留
- **异常处理**：入档前逐文件 grep 确认无 src 内非 pi 引用；入档后 grep 零残留

### 依赖清理规则
- **场景**：package.json 清理时
- **行为**：删除 devDeps `@earendil-works/pi-coding-agent`、`@earendil-works/pi-tui` 与 dep `typebox`；删除 scripts `compile:pi`、`deploy:pi`，`compile` 改为 `compile:mcp && compile:cli`
- **异常处理**：`typebox` 仅 pi 工具使用（ListAgentsTool/AgentCommTools/ChildExtension），确认无其他引用后删除

### README 清理规则
- **场景**：README.md 中 pi 相关引用清理时
- **行为**：技能路径 `.pi/skills/...` 改指 `.dsh/skills/...`；删除 `.pi/APPEND_SYSTEM.md`/`.pi/skill-standards-ref.md` 相关文件行、"Pi Agent 集成" 小节、Loop 状态机插件（`.pi/extensions/init_feature/`）说明、项目结构中的 `.pi/` 行；`adapter/` 行注释改为 CLI / MCP
- **异常处理**：README 第 7 行"CLI 和 MCP Server 两种适配形态"保持，可补充 pi 扩展形态已移除

## 预设测试

> 从用户视角可执行的测试步骤，验证功能是否符合预期。

### 前置条件
- 已确认 `.archive/retired_pi.008/` 既有内容（`.pi/` 运行时配置）保留
- 工作区干净可构建（node_modules 就绪）

### 测试步骤

1. **[残留检查]**：grep `DiscoverAgentsUseCase|AgentRequestUseCase|ScopePolicy|IAccessPolicyService|IGuardToggleService|GuardToggleService|IAgentMessagingService|agentRepository|AgentRepositoryImpl|GuardToggleStore|IAgentRepository|AgentDefinition|AgentRunResult|AgentUsage|data/services/scope|PI_EXT_SKIP|pi/extension|deploy-pi|compile:pi|pi-coding-agent|pi-tui|adapter/pi`
   **预期结果**：在 `src/`、`scripts/`、`vite.config.ts`、`package.json` 中零匹配（README 允许 `.dsh/skills` 无 pi 字样，`.archive/` 内允许）
2. **[构建验证]**：`npm run compile:mcp` 与 `npm run compile:cli`
   **预期结果**：两者均成功产出 `dist/mcp-server.js` 与 `dist/cli/iflow.js`；`npm run compile` 不触碰 pi
3. **[MCP 注册不变]**：启动 MCP 服务器
   **预期结果**：注册工具仍为 `["check_file_size","project_intent"]`
4. **[MCP 压测]**：`npm run verify:mcp`
   **预期结果**：compile + stress test 全绿（阶段 A 帧纯净、阶段 B 并发通过）
5. **[CLI 冒烟]**：`node dist/cli/iflow.js <cmd> --help`（check-file-size / trace-dependency-chain / project-intent / list-folder-intents）
   **预期结果**：四条命令均正常输出 usage，无引用错误
6. **[测试套件]**：`npx vitest run` 连续 3 次
   **预期结果**：每次全绿（pi 相关测试随文件入档后不再运行，剩余套件稳定）
7. **[归档核对]**：检查 `.archive/retired_pi.008/` 下 adapter/pi、application（useCases/services）、data（repositories/services/entities）、scripts（deploy-pi.js、fetch-release.js）结构与源路径一致
   **预期结果**：文件齐全，既有 `pi/` 运行时配置未受影响

### 异常场景

- **[归档残留]**：grep 发现 src 内仍有 pi 组件引用 → 定位引用方，确认是否属于保留面；若为遗漏引用则一并处理
- **[构建失败]**：compile:mcp/cli 因 CoreDIContainer 剪线报错 → 检查被剪字段是否仍被 mcp/cli 容器访问，恢复保留面组件
- **[依赖残留]**：`@earendil-works/pi-*` 仍被引用 → 检查引用源，全部在入档文件内则正常

## 边界收束

**此时必做**：
- 两个入档目标路径（`src/adapter/pi`、`scripts/deploy-pi.js`）+ `scripts/fetch-release.js` 入档
- pi 独占 application/data 组件与测试入档（用户已确认"完全清理"）
- CoreDIContainer 剪线、各层索引出口清理
- vite.config / package.json 清理（否则 compile:pi 指向不存在入口）
- README pi 引用清理（用户已确认）
- 预设测试 7 项全绿

**此时不做**：
- 不删除 `.archive/` 目录本身，不触碰已入档的 `.pi/` 运行时配置
- 不重构 CLI/MCP 共享的 CoreDIContainer 结构（仅剪死线）
- 不处理 `.pi` 相关历史遗留文档（如 `scripts/mcp-stress-test.mjs` 之外的其他非活跃文件）——本次仅限需求清单所列

## 实现对齐

- **[pi 适配层入档]**：`git mv`（或 move）`src/adapter/pi` → `.archive/retired_pi.008/adapter/pi`，保持相对路径；`scripts/deploy-pi.js`、`scripts/fetch-release.js` → `.archive/retired_pi.008/scripts/`
- **推导出的约束**：
  - ✅ 归档目录 `.archive/retired_pi.008/` 已存在（含 `.pi/` 运行时配置），本次仅追加新内容
  - ✅ 归档布局沿用 retired-vscode.005 惯例：`src/` 下相对路径直接对应到 archive（`src/adapter/pi` → `adapter/pi`），`scripts/` 直接对应
  - ✅ 入档前 grep 确认 pi 独占组件零外部引用（CLI/MCP 均不引用，已核实）
  - ✅ `@earendil-works/pi-coding-agent`/`pi-tui` 仅 pi 使用，`typebox` 仅 pi 工具使用（ListAgentsTool/AgentCommTools/ChildExtension），可随依赖清理移除
  - ✅ vitest include 为 `src/**/*.test.ts`，pi 测试随目录移出 src 后自动不再运行
  - ✅ `npm run compile` 由 `compile:mcp && compile:cli && compile:pi` 改为 `compile:mcp && compile:cli`
- **design 决策**：
  - 🎯 移除依赖后是否同步执行 `npm install` 更新 package-lock.json（手动改 package.json + 由 npm 重算 lock 的取舍）
  - 🎯 README 中 Loop/状态机段落的保留方式（整段删除 vs 改写为设计思路说明）
