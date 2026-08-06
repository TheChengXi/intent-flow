# project-intent-hardening 关账报告

## 1. 项目概览
`intent-flow_project_intent` 工具投射 @intent 时，对文本中的注释特殊序列（块注释终止序列、行首 @）自动转义，提取侧对称还原，杜绝投射后产生语法错误（TS1127/TS1109）或意图文本静默截断。

## 2. 计划 vs 实际

| 计划功能（requirement.md） | 状态 | 说明 |
|---|---|---|
| 投射侧转义：块注释 `*/`→`*\/`、所有注释风格行首 `@`→`\@` | ✅ 完成 | `intentTextEscaping.escapeBlockCommentText / escapeLineCommentText`，接入 `generateIntentBlock` 块/行注释分支；裸文本分支不转义 |
| 提取侧还原：`*\/`→`*/`、`\@`→`@` 闭环 | ✅ 完成 | `unescapeIntentText` 接入 `extractIntentFromLines` 返回前 |
| 测试锁定：词法安全 + 还原一致 + 既有回归 | ✅ 完成 | 69/69 全绿（新增 28 例：转义 17 + 提取 18 + useCase 5 含既有 21）；tsc --noEmit 零错误 |
| grep 残留检查假阳性 | ❌ 未做（按确认排除） | 操作记录，非工具缺陷，已入 later-on.md 经验备忘 |

## 3. 关键决策
- **执行期无偏离设计**：三文件改动与 design.md 完全一致（diff 最小化：import + 分支挂接 + 返回处套还原）。
- **转义序列选 `*\/`/`\@`**：需求分析阶段实测排除 `* /`（提取侧无法安全还原）。执行期验证无二次转义（`*\/` 中 `*` 后是 `\`、`\@` 行首是 `\`）。
- **还原作用于拼接后文本**（非行级）：design 决策 3，误伤率极低，实现最简。

## 4. 经验记录
- **有效做法**：
  - 需求分析阶段用本机链路（tsc + 内联提取逻辑）实测转义方案，替代不可用的联网搜索——证据比搜索更硬
  - 隔离 TDD 三 agent 模式有效：test-writer 的红灯用例精确锁定了待接入行为（17+18+5 例），code-writer 只需最小改动转绿
  - reviewer 第零阶段"先跑测试"拦截了全项目 tsc 状态核查，发现 @intent 残留碎片
- **踩坑**：
  - **MCP 工具链走 dist/ 编译产物**：直接调 `intent-flow_project_intent` 验证时仍执行旧代码，生成的临时文件含裸终止序列且 tsc 报错——验证前需确认验证对象是 src 还是 dist。本次跳过 dist 构建（用户确认），真实链路需 build 后生效
  - **投射工具替换 @intent 时残留旧块碎片**：force=true 替换产生旧块尾部重复 + 新块插入旧块内部（本次手工清理两次）——已记录 later-on.md，建议独立 feature 修复
  - 在 JSDoc 注释中写裸终止序列会提前闭合块注释（code-writer 自身踩了一次），中文表述规避
- **工具反馈**：
  - `intent-flow_project_intent` 工具缺陷二则：(a) 替换时残留旧 @intent 碎片（重要）；(b) 此前已知的注释闭合性问题已由本 feature 的转义解决
  - `vscode_get_diagnostics` 在 bash 中无输出（本会话未能使用，改用 tsc 验证）

## 5. 后续待办
- **立即跟进**：无阻塞项。dist 产物未重新构建，`intent-flow_project_intent` MCP 工具的实际生效需 `npm run compile:mcp`（用户确认暂缓）
- **长期备忘**：
  - 投射工具替换残留 bug（独立 feature）— 详见 `D:/w_dev/IntentFlow/.intentflow/project-intent-hardening/later-on.md`
  - 提取器标签边界语义重构、转义规则表扩展、投射后回读验证 — 同上文件

## 6. 开发工作流反馈
- **流程断点**：execute 阶段三"集成验证"未覆盖"真实工具链路"（MCP → dist）与"src 链路"（vitest/tsc）的差异——集成验证应明确验证对象层级，或提供"构建后重验"钩子
- **skill 建议**：隔离 TDD 三 agent 的 task 中已含"注释中不写裸终止序列"的安全约定，可上升为 execute skill 的通用规范（任何写注释的 agent 都适用）
- **工具链瓶颈**：无

## 7. 结论
- **当前状态**：可发布（源码层 69/69 全绿 + tsc 零错误；dist 产物待构建后生效）
- **建议下一步**：构建 dist 后重跑一次 MCP 真实链路验证；随后启动投射工具替换残留 bug 的修复 feature
