# pi-removal 关账报告

## 1. 项目概览
废弃 pi 适配层：`src/adapter/pi` 整目录（24 文件）+ `scripts/deploy-pi.js` + `scripts/fetch-release.js` 连同 pi 独占的 application/data 组件与测试一并移入 `.archive/retired_pi.008/`，清理构建（vite.config）、依赖（`@earendil-works/pi-*`、typebox）、索引出口与 README，项目收敛为 CLI + MCP 两种适配形态。

## 2. 计划 vs 实际
- ✅ pi 适配层入档：`src/adapter/pi`（24 文件含 3 测试）→ `.archive/retired_pi.008/adapter/pi/`
- ✅ 部署脚本入档：`scripts/deploy-pi.js` → `.archive/retired_pi.008/scripts/`（普通 move，git 未跟踪）
- ✅ Release 脚本入档：`scripts/fetch-release.js` → `.archive/retired_pi.008/scripts/`（git mv 保留历史）
- ✅ application 层独占组件入档：DiscoverAgentsUseCase、AgentRequestUseCase（+测试）、ScopePolicy、IAccessPolicyService、IGuardToggleService、GuardToggleService（+测试）、IAgentMessagingService、agentRepository 透出（12 文件）
- ✅ data 层独占组件入档：AgentRepositoryImpl（+测试）、GuardToggleStore（+测试）、IAgentRepository、AgentDefinition/AgentRunResult/AgentUsage、data/services/scope（9 文件）
- ✅ 接线清理：CoreDIContainer 移除 agentRepo/guardToggleStore/guardToggleService 及 import；useCases/repositories/entities 三个索引移除 pi 项
- ✅ 构建与依赖清理：vite.config 移除 pi 入口与 piProvidedPackages；package.json 移除 compile:pi/deploy:pi/fetch-release 脚本、`@earendil-works/pi-coding-agent`/`pi-tui` devDeps、`typebox` dep；`npm uninstall` 同步 package-lock（-5363 行，移除 388 包）
- ✅ README 清理：`.pi/...` 引用改指 `.dsh/skills/...`；删除 "Pi Agent 集成" 小节、Loop 状态机插件实现段落、项目结构 pi 行、skill-standards-ref 文件引用；顺手修正过时的 `iflow intent-package` 命令引用（CLI 实际仅 4 命令）
- ✅ `.gitignore`：删除 `!scripts/fetch-release.js` 白名单行（随脚本入档成为死配置）
- ✅ 验证全绿：grep 零残留、compile:mcp（429.26 kB）、compile:cli（297.72 kB）、verify:mcp（工具数 = 2）、CLI 4 命令冒烟、vitest 56/56 ×3
- ✅ 清理本地 `dist/pi/` 陈旧构建产物与空目录（`src/application/services/`、`src/data/services/agent|guard|scope`）

## 3. 关键决策
- **`scripts/deploy-pi.js` 用普通 move 而非 git mv**：设计阶段发现该文件被 `.gitignore` 的 `scripts/*` 规则排除、从未被 git 跟踪；入档后位于 `.archive/`（未被忽略）变为新跟踪文件，符合归档语义。
- **依赖移除走 `npm uninstall` 而非手编 package-lock**：`@earendil-works/pi-coding-agent` 子树含 100+ 传递依赖，手编 lock 极易出错；npm uninstall 本地操作自动重算 lock（结果 -5363 行 / 388 包）。
- **README 技能路径改指而非删除**：`.pi/skills/...` 早已失效（技能现位于 `.dsh/skills/`），改指 `.dsh/skills/...` 保持文档可用；`.pi/APPEND_SYSTEM.md`/`skill-standards-ref.md` 已随 `.pi` 入档且 `.dsh/` 无对应物，删除引用行。
- **@intent 注释避免类名残留**：入档说明文字改用 "agent 域" 等不带类名的表述，保证 grep 零残留验证可自证（沿用 mcp-tools-removal 先例）。
- **README 顺手删除 `iflow intent-package`**：该命令实际不存在（CLI 注册表仅 4 条），属过时引用，删除而非保留。

## 4. 经验记录
- **有效做法**：执行前逐文件 grep 消费方（CLI/MCP 均不引用 pi 独占组件），确认入档安全后才动手；归档沿用 retired-vscode.005 的 `src/` 相对路径惯例，可预测、可核对。
- **有效做法**：git mv 保留文件历史，归档与删除二选一时优先移动；`.archive/` 未被 gitignore，入档即入版本库。
- **踩坑**：`scripts/*` 的 gitignore 规则使 `deploy-pi.js` 从未被跟踪，直接 git mv 会失败（pathspec 不匹配）——先查 `git ls-files` 确认跟踪状态再选 move/git mv。
- **踩坑**：README 中存在与现状脱节的引用（`.pi/skills` 已失效、`intent-package` 命令不存在），清理时需以实际目录/注册表为准，不能照抄既有文本。
- **工具反馈**：移除依赖后 `npm uninstall` 产生 ERESOLVE peer 警告（vite 5 vs vitest 4 的既有冲突），与本次无关，但确认构建/测试全绿后才判定无影响。

## 5. 后续待办
- 立即跟进：无（本次全部完成）
- 长期备忘：`D:\w_dev\intent-flow\.intentflow\pi-removal\later-on.md` — L01（CLI 与 MCP 二选一）、L02（archive 复活 agent 域成本）、L03（README 技能路径单一事实源）、L04（`scripts/` git 忽略策略）

## 6. 开发工作流反馈
- 无流程断点：requirement → design → execute 三阶段衔接顺畅，需求阶段确认的"完全清理"范围在执行中未扩大。
- 设计阶段偏差记录机制有效：deploy-pi.js 未跟踪、fetch-release script、typebox 顶层依赖、`.dsh/skills` 路径等 6 处偏差在设计文档 §0 提前暴露，执行零返工。
- 建议：gitignore 中 `scripts/*` + 白名单的局部忽略模式易造成"文件在磁盘但不在 git"的隐蔽状态，设计阶段对涉及 scripts 的改动应默认检查 `git ls-files`。

## 7. 结论
- 当前状态：**可发布**。归档完整（47 重命名 + 2 新文件），引用零残留，构建/压测/CLI/测试套件全绿，依赖树收敛（-388 包）。
- 建议下一步：按 later-on.md L01 评估 CLI 与 MCP 的最终消费形态；如 MCP 成为唯一形态，可参考 mcp-tools-removal 先例继续收敛。
