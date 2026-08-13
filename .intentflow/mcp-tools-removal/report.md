# mcp-tools-removal 关账报告

## 1. 项目概览

从 MCP 适配层移除 `TraceDependencyChainTool` 与 `ListFolderIntentsTool` 两个工具，保留服务器本体及 `check_file_size`、`project_intent` 两个工具，使 MCP 服务器重启后不再暴露 `trace_dependency_chain`、`list_folder_intents` 能力。

## 2. 计划 vs 实际

- ✅ **删除工具文件**：删除 `src/adapter/mcp/tools/TraceDependencyChainTool.ts` 与 `ListFolderIntentsTool.ts` —— 完成，两文件已从工作区移除
- ✅ **引用清理**：清理 `tools/index.ts` 的 export、`DIContainer.ts` 的字段/构造/工具列表、根 `README.md` 工具表 —— 完成，grep 零提及
- ✅ **回归验证**：`compile:mcp` 构建成功、MCP 服务器启动正常、工具注册数 = 2、`verify:mcp` 全绿、CLI 双命令冒烟正常、全量测试 139/139 × 3 次循环 —— 完成
- 🔸 **压测脚本同步**：`scripts/mcp-stress-test.mjs` 硬编码引用已删工具 —— 执行阶段新发现，已同步修正（该文件被 .gitignore 忽略，改动仅本地生效，不进 commit）

## 3. 关键决策

- **只删两个工具，不删整个 adapter/mcp 目录**：用户在需求阶段三选一明确选择；MCP 服务器本体（`MCPServer.ts`/`DIContainer.ts`/`vite.config.ts` 入口/package.json 脚本）全部保留
- **`mcp-stress-test.mjs` 执行阶段修正**：设计阶段假设其"继续有效"不成立——脚本硬编码 `trace_dependency_chain` 与"工具数量 >= 4"断言，`verify:mcp` 必挂。执行中将其改为 `check_file_size` 并断言工具数 = 2，压测通过
- **@intent 措辞规避类名**：`tools/index.ts` 与 `DIContainer.ts` 的 @intent 原写入类名"已移除"说明，会导致 grep 残留检查失真，改为"其余两个 MCP 工具已移除（mcp-tools-removal）"描述
- **提交范围隔离**：会话前已存在的 DSH 工作区局部改动（`.gitignore`/`start-dsh.bat`/`.dsh/`/`.pi/APPEND_SYSTEM.md`）与 feature 无关，提交时仅纳入 feature 相关文件

## 4. 经验记录

- **有效做法**：
  - 删除类 feature 用 grep 零提及作为"清理干净"的客观判据，直接可验证
  - 需求阶段对"删文件夹 vs 删文件"的歧义（用户列出的两个工具文件在文件夹内）提前用选项确认，避免误删整个适配层
  - 构建/运行类验证（vite、vitest、MCP stdio 子进程）需要 spawn 子进程，受限沙箱 EPERM——已知边界，一次性升级权限执行
- **踩坑**：
  - 设计阶段把"脚本仍引用被删工具"误判为"继续有效"——对硬编码工具名的脚本（`mcp-stress-test.mjs` 的 `TOOL_TRACE`、`>= 4` 断言），删除工具时必须同步排查引用，而不是默认保留
  - @intent 中写入类名会破坏 grep 残留判据，规格注释应写语义描述而非类名
- **工具反馈**：
  - 无

## 5. 后续待办

- **立即跟进**：无（本 feature 已完整交付，验证全绿）
- **长期备忘**：引用 `D:\w_dev\intent-flow\.intentflow\mcp-tools-removal\later-on.md`——L01 整体移除 MCP 适配层、L02 check_file_size/project_intent 双封装重叠、L03 工具自动发现注册

## 6. 开发工作流反馈

- 删除类 feature 的 execute 阶段缺少"删除目标是否被脚本/配置硬编码引用"的强制检查点，本次 `mcp-stress-test.mjs` 依赖漏检，靠 `verify:mcp` 回归才暴露。建议 requirement/design 阶段对"引用该对象的全部消费者"（含脚本、构建配置、文档表）做一次显式枚举
- 其余环节（requirement 澄清 → design 分层 → execute 三阶段 → verify）衔接顺畅，无断点

## 7. 结论

- **当前状态**：可发布。删除完成、引用清理干净（grep 零提及）、`verify:mcp` 全绿、全量测试 139/139 × 3 次循环稳定
- **建议下一步**：若 MCP 消费场景不再需要，可启动 L01（整体移除 MCP 适配层，连带清理 vite.config/package.json 脚本/压测脚本/README/dist 产物）
