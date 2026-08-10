# codebase-health-check 关账报告

## 1. 项目概览
对 src/ 全目录执行综合健康检查（架构分层 + @intent 契约 + 代码质量），补齐 13 个缺失 @intent 的文件，产出诊断报告。

## 2. 计划 vs 实际

| 计划功能 | 状态 | 说明 |
|---|---|---|
| 架构健康检查 | ✅ 完成 | 发现 2 项架构问题（见 §5 立即跟进），按边界收束只报告不修 |
| @intent 契约检查 | ✅ 完成 | 15 个缺失文件：13 个补齐（9 业务必补 + 4 测试建议补），2 个 .d.ts 按设计决策不补 |
| 代码质量检查 | ✅ 完成 | 全量 174 文件大小扫描 0 超限；死代码防线已由历史 feature 开启 noUnusedLocals 覆盖 |
| 自动修复 | ✅ 完成 | @intent 补齐全部执行；架构类修复按需求边界延后 |
| 诊断报告 | ✅ 完成 | 本报告 + report.md 即交付物 |

## 3. 关键决策
- **MCP 工具连接不稳定**：`intent_flow_project_intent` 并行调用时连接断开（Connection closed），3 个文件成功后改用本地 edit 工具手动投射 @intent，格式与项目块注释惯例对齐。结果一致，无偏差。
- **全量大小扫描实现**：mcpScript 沙箱无 fs/require，文件清单由 bash `find` 提供后嵌入脚本，分批（10 并发）调用 `check_file_size` 完成 174 文件扫描。
- **tsc 复检时机**：探索性调用曾被阻止，作为设计规定的阶段三复检步骤执行（EXIT=0），未跳过。

## 4. 经验记录
- **有效做法**：`intent_flow_project_intent` 单调用稳定、批量并行必断 → 小批量串行或直接用 edit 写入；@intent 补齐属纯注释改动，直接模式验证（测试 + tsc）即可锁定。
- **踩坑**：mcpScript 沙箱无 Node 文件系统能力，涉及文件遍历的批量工具调用需 bash 先行产出清单；`grep -qL` 在 for 循环中结果不可靠，用 `grep -q || echo` 模式。
- **工具反馈**：intent-flow MCP server 并行调用连接不稳定，建议增加重试/串行化机制；check_file_size 返回结构与预期略有差异（需探测 data 字段形态）。

## 5. 后续待办
**立即跟进**（执行阶段发现的未修项）：
- `src/adapter/vscode/application/dryrun/DryRunManager.ts`：adapter 层直接依赖 data 服务/仓库（DryRunRepository、DryRunStatisticsService），且 application 层无 DryRun UseCase → 跨层依赖 + 逻辑未下沉，需独立 feature 重构
- `src/adapter/mcp/tools/CheckFileSizeTool.ts`：唯一直接 import data/entities 类型的 Tool（其余 Tool 从 UseCase 文件取类型）→ 类型定义位置不一致，建议将 FileSizeCheckInput/Result 迁移至 UseCase 文件

**长期备忘**：见 `D:\w_dev\intent-flow\.intentflow\codebase-health-check\later-on.md`（7 项：脚本固化、文件拆分、CVE 审计、运行期验证、@intent 语义校验、webview 深度体检、测试 @intent 强制化）

## 6. 开发工作流反馈
- 诊断编排型 feature（无新增代码）在 execute 三阶段中走"投射→验证"即可闭环，logs/ 子 agent 机制对直接模式无感，流程无断点。
- 设计阶段的"批次规划（只读→写→复检→报告）"与实际执行吻合，检查清单作为执行蓝图有效。
- 建议：对纯检查型 feature，design.md 中的"前置验证结论"可扩展为可勾选的检查矩阵，execute 阶段按矩阵逐项核对，报告自动生成。

## 7. 结论
- **当前状态**：可发布。13 个文件 @intent 补齐，全量测试 9 文件 / 131 测试 3 轮循环全绿，tsc --noEmit 零错误，@intent 覆盖复扫仅剩 2 个 .d.ts（设计决策豁免）。
- **建议下一步**：为 DryRunManager 跨层依赖单开重构 feature（下沉 DryRun 逻辑至 application 层）；后续体检可参考本 feature 的检查矩阵复用。
