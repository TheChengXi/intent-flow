# unused-code-cleanup 关账报告

## 1. 项目概览

开启 TypeScript 的 `noUnusedLocals` + `noUnusedParameters` 编译选项，清理由此暴露的 29 个存量未使用代码（19 个文件），使"未使用代码"进入编译期强制拦截。

## 2. 计划 vs 实际

| 计划功能 | 状态 | 说明 |
|---|---|---|
| 编译选项开启（tsconfig 2 行） | ✅ 完成 | noUnusedLocals + noUnusedParameters，与 tsc 零错误基线叠加 |
| data 层清理（5 文件） | ✅ 完成 | 7 处（删 import ×3、_ttl、删遮蔽声明、接口参数下划线 ×2、_language） |
| vscode 层清理（4 文件） | ✅ 完成 | 6 处（删 container/DryRunRecord/VSCodeDIContainer、_progress ×2、_workspaceRoot） |
| pi 层清理（10 文件） | ✅ 完成 | 15 处（删 import/声明/解构、formatUsage/ensureVisible 删参数连带改 5 处调用、_isFocused/_themeFg） |
| application 清理（1 文件） | ✅ 完成 | 1 处（删 ProjectIntentInput 类型 import） |
| 每批次 tsc 验证（单调递减） | ✅ 完成 | 0 → 29（确认全暴露）→ 22 → 16 → 0 |
| 全量回归 | ✅ 完成 | 选项生效验证 + vitest 29/29 + CLI/pi 冒烟 |

> 注：设计文档分层计数（vscode 7 处 / pi 14 处）与实际（6 处 / 15 处）有 1 处偏差，总数 29 与逐条清单无偏差，不影响执行正确性。

## 3. 关键决策

1. **无 @intent 投射** — 20 个文件全部为"删除未使用声明/参数下划线"，职责零变化（@intent 描述"文件为什么存在"，清理不改变规格），阶段一跳过投射并记录理由。
2. **下划线前缀 vs 删参数二分** — 接口实现/公共 API/回调签名（7 处：_ttl/_functionName/_workspaceRoot/_language/_progress×2/_isFocused/_themeFg）保留下划线；私有函数/方法（formatUsage、ensureVisible 共 2 处）删参数连带改调用处。连锁检查确认：SpawnAgentTool 调用处 theme 变量仍被大量使用（无连锁污染），AgentListPanel 3 处调用统一替换。
3. **副作用逐个确认** — ToolAccessGuard 构造函数无副作用（仅存字段）→ guard 可删；`const started = Date.now()` 无副作用 → 删；`let stdout = ''` 连写入都不存在（否则不算"never read"）→ 删；TypeScriptResolver 79 行是方法内遮蔽声明（顶部 import * as path 仍服务 70 行）→ 删。
4. **选项生效验证采用 CLI 参数对照法** — 直接命令行指定文件时 tsconfig 不加载，改用 `--noUnusedLocals` 显式参数对照（带参数报 TS6133 / 不带通过），证明选项语义正确；tsconfig 生效本身由"无参数 tsc 报出 29 个错误"证明。

## 4. 经验记录

### 有效做法
- **"错误清单即需求"的批量清理模式**：29 处错误清单在 requirement 阶段就逐条定位（文件+行号+变量名），设计阶段逐个判定处理方式（删/下划线/删参数），实现阶段纯机械执行——三个 feature 以来最顺畅的一次批量清理。
- **连锁检查前置**：删函数参数前先查调用处变量是否还有他用（formatUsage 的 theme、ensureVisible 的 total），避免"修一个错引出下一个错"。
- **副作用判定经验法则**：TS 的 "never read" 语义本身就排除了"被写入"的变量（stdout 案例）——报错即证明无任何读取，删除安全性高于直觉。

### 踩坑
- **edit 工具同调用多文件失败**：曾将两个不同文件的 edit 放在同一调用（path 是单文件的），以及同文件内一处未匹配导致整个调用失败（LogPanel import 未匹配导致 render 参数修改也没应用）——下次先确认每处 oldText 精确匹配，或分批调用。
- **tsx -e 相对路径解析**：`tsx -e` 与 /tmp 下脚本的 import 解析不到项目 node_modules（compile-error-repair 已遇一次，本次又踩）——冒烟脚本必须放项目目录内执行。
- **设计文档分层计数笔误**：vscode 7 处/pi 14 处与实际 6/15 不符（总数对）。下次设计阶段用脚本统计而非手数。

### 工具反馈
- `intent-flow_project_intent` 无本次使用场景（无投射），工具链其余正常。

## 5. 后续待办

### 立即跟进
- 无（4 批次全部完成，tsc 零错误 + 回归通过）

### 长期备忘
- `.intentflow/unused-code-cleanup/later-on.md`（D:\w_dev\IntentFlow\.intentflow\unused-code-cleanup\later-on.md）：
  1. 其他严格选项评估（noUncheckedIndexedAccess 影响面最大）
  2. 预留参数 `_` 前缀约定沉淀
  3. 项目级死代码扫描工具评估（knip / ts-prune）
  4. 测试文件未使用代码同标准
  5. searchInWorkspace 废弃确认（当前 `_workspaceRoot` 保守保留，无调用方）

## 6. 开发工作流反馈

- **流程顺畅点**：requirement 阶段"探索先行"（模拟开启选项摸清 29 处清单）使整个 feature 可预期、可验证，验证了"先量化再立项"的流程价值。
- **skill 建议**：execute skill 可补充"批量删除型清理"的模板——错误清单逐条判定处理方式（删/下划线/删参数+连锁检查）的三分法已三次验证有效（interface-layer-reorg 的引用链验证、compile-error-repair 的错误数递减、本次的逐条判定）。
- **工具链建议**：edit 工具对"多处小改动"的原子性不足（一处不匹配整调用失败），可考虑支持"部分成功"语义或先 dry-run 匹配检查。

## 7. 结论

- **当前状态：可发布** — 29 处未使用代码全部清除，tsc 零错误（含新选项），vitest 29/29 语义未变，CLI/pi 冒烟通过；接口签名零改动，运行时行为零变化。
- **建议下一步**：向 package.json 增加 `"typecheck": "tsc --noEmit"` script（compile-error-repair later-on 遗留）并接入发布前检查；随后处理 unused-code-cleanup later-on 第 5 条（searchInWorkspace 无调用方，确认后可删）。
