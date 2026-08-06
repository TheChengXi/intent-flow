# interface-layer-reorg 关账报告

## 1. 项目概览

删除接口层（src/data/entities + src/data/repositories）中已废弃/死链的接口定义，收敛大版本更新遗留的重复定义，使接口层成为数据层类型的唯一出口。

## 2. 计划 vs 实际

| 计划功能 | 状态 | 说明 |
|---|---|---|
| 删除完全废弃实体 IntentPackage | ✅ 完成 | 零引用 + 多处 @warn 标注 |
| 删除死链对（CallDependency + ICallGraphAnalyzer） | ✅ 完成 | 接口只被死接口引用，整链无实现 |
| 删除死链对（Errors + FileRepository） | ✅ 完成 | 错误类只被死模块引用 |
| 收敛 6 对重复定义（entities 为唯一出口） | 🔸 修正 | 设计阶段发现 5 对载体文件整文件零引用，改为整文件删除（更彻底）；TypeDefinition 无冲突保留 |
| IntentExtractor 瘦身 | ✅ 完成 | 266 → 43 行，仅保留活的 extractIntentFromLines |
| 重整 index.ts 导出 | ✅ 完成 | entities 13 → 9 个；repositories 移除 ICallGraphAnalyzer |
| CLI 废弃命令清理（附加） | ✅ 完成 | 集成验证发现基线 bug（intentPackageHandler 未定义阻塞 CLI），随 feature 一并修复 |
| 每批次 tsc 验证 | ✅ 完成 | 7 批次全部"无新增错误"（对比基线 113 错误） |
| 全量回归（vitest + 冒烟 + 残留检查） | ✅ 完成 | 29/29 测试通过；CLI 冒烟正常；grep 残留干净 |

## 3. 关键决策

1. **C 类从"收敛"改为"整文件删除"**（设计阶段）— 原假设 services 内嵌定义是活跃代码，验证发现 PartialContextExtractor / FullContextExtractor 整文件零引用。净效果：活跃代码零 import 修改，纯删除。
2. **验证判据从"tsc 零错误"改为"不新增错误"**（执行阶段）— 基线存在 113 个与本次无关的 tsc 错误（pi-tui 模块缺失、webview DOM lib、test mock 类型、意图包残留引用）。用 git stash 对比确认基线后，以 diff 判据逐批次验证。
3. **CLI 废弃命令条目修复纳入本次**（集成验证阶段）— intent-package 命令引用从未定义的 handler，导致 CLI 启动即崩，阻塞冒烟验证；与意图包废弃目标一致，纳入并记录于 design.md。
4. **IntentExtractor 瘦身采用逐字复制** — 保留函数代码逐字不变，行为零改动，用冒烟脚本验证 6 种输入场景符合 @intent 验收条件。

## 4. 经验记录

### 有效做法
- **基线对比验证法**：删除型重构用 `git stash` 获取基线错误清单，后续每批次 `diff` 对比"无新增错误"——比"零错误"判据更实用，且能自动捕获意外破坏。
- **删除前引用链验证**：先验证"载体文件本身是否存活"再决定收敛或删除，避免了 5 个无意义的收敛操作。
- **冒烟脚本验证纯函数保留**：瘦身/保留活代码时，用独立脚本覆盖输入边界（多行块/单行/注释格式/null/空数组/遇 @tag 停止），行为可自证。

### 踩坑
- **@intent 文本含 `*/` 会提前终止块注释**：投射到 IntentExtractor.ts 时文本中"支持 /** */"导致语法错误（TS1127/TS1109）。修复后改写为"星号块注释"。**下次投射含特殊字符的文本前先转义。**
- **grep 残留检查的假阳性**：`FileRepository` 模式匹配到活接口 `IFileRepository`。用精确路径模式（`from.*repositories/FileRepository'`）复查。

### 工具反馈
- `intent-flow_project_intent` 投射 @intent 时不校验注释闭合性，含 `*/` 的文本直接产生语法错误——建议工具侧做块注释转义或校验。

## 5. 后续待办

### 立即跟进
- 无（本 feature 全部计划项已完成，附加修复已验证）

### 长期备忘
- `.intentflow/interface-layer-reorg/later-on.md`（D:\w_dev\IntentFlow\.intentflow\interface-layer-reorg\later-on.md）：
  1. TraceDependencyChainUseCase.DependencyInfo 重命名消歧（entities 版删除后成为唯一同名类型）
  2. webview renderIntentPackage / intent-package 场景节点清理验证（UI 层独立概念）
  3. 全项目统一 import entities/index.ts 的评估（当前直接路径无害）
  4. IFileRepository 与 FileSystemRepository/FileWatcher 关系评估
  5. IntentExtractor 文件名名不副实（仅剩单函数），未来可重命名
  6. 删除文件的 @intent 归档说明

## 6. 开发工作流反馈

- **流程断点**：requirement 阶段无法预知"死代码删除"场景下 services 层内嵌定义与 entities 层的真实关系，设计阶段必须重新验证引用链——本次通过 design 阶段的深度验证避免了错误实现。建议 requirement/design 对删除型 feature 增加"载体文件存活验证"步骤的显式要求。
- **工具链瓶颈**：`tsc --noEmit` 基线 113 个错误说明项目编译健康度差（pi-tui 依赖缺失、webview DOM lib 配置、test 文件 mock 类型），干扰任何 feature 的验证。建议另立 feature 修复编译基线（安装 pi-tui、webview tsconfig 加 DOM lib、修复 test mock 类型）。
- **skill 缺失**：删除型 feature 的"每批次验证"无现成模板，本次自建"基线 diff"流程，可考虑沉淀到 execute skill。

## 7. 结论

- **当前状态：可发布** — 12 个死文件删除 + 4 个文件修改全部验证通过（tsc 错误 -1、vitest 29/29、CLI 冒烟正常、残留干净），活跃代码零行为改动。
- **建议下一步**：优先修复编译基线（113 个既有错误），使后续 feature 恢复"tsc 零错误"标准；随后按 later-on.md 处理 DependencyInfo 重命名消歧。
