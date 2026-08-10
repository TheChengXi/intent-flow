# 设计文档：codebase-health-check

> 基于 `.intentflow/codebase-health-check/requirement.md`。已有项目，顺应原有三层结构（adapter / application / data + 共享 types）；本次为**诊断编排型** feature，不新增常驻代码模块。

## 0. 设计前置验证结论

| 验证项 | 结论 |
|---|---|
| src/ 下 .ts 文件规模 | 175 个（不含 webview/node_modules、tree-sitter wasm 二进制） |
| @intent 缺失 | 15 个文件：业务源文件 9 + 测试文件 4 + .d.ts 2 |
| 三层结构 | adapter（cli/mcp/pi/vscode 四形态）/ application（useCases+services）/ data（entities+repositories+services）/ types（共享） |
| 现有检查工具 | `trace_dependency_chain`（支持自定义 layerConfig 按层分组）、`check_file_size`（默认 400 阈值）、`project_intent`（投射 @intent） |
| 死代码防线 | 历史 feature `unused-code-cleanup` 已开启 noUnusedLocals/noUnusedParameters，编译期拦截已生效 |
| webview 子项目 | `adapter/vscode/ui/webview/` 是独立 Vue 应用（独立 tsconfig/package.json），不适用三层依赖判定 |

## 1. 模块清单

本次不新增 src/ 代码，模块边界 = **检查维度**，每个维度定义职责、判定标准、工具依赖：

| 模块 | 层级归属 | 职责 | 依赖工具 |
|---|---|---|---|
| 维度 A：架构依赖检查 | 执行编排（复用现有能力） | 检测跨层/反向依赖，判定三层方向合规性 | `trace_dependency_chain`（自定义 layerConfig：data/application/adapter）+ grep 复核 |
| 维度 B：@intent 契约检查 | 同上 | 扫描缺失/空占位 @intent，补齐业务源文件 | grep 扫描 + `project_intent` 投射 |
| 维度 C：代码质量检查 | 同上 | 文件大小（>400 行）、死代码/未使用导出、命名一致性 | `check_file_size` + `tsc --noEmit` + grep 调用方统计 |
| 报告 | 产出物 | 汇总问题清单/修复记录/剩余风险，落盘 report.md | 无（文档产出） |

## 2. 依赖链（执行流程）

```
扫描清单收集 (find src)
  → 维度A：trace_dependency_chain 按层分组 → grep 复核跨层 import → 判定合规
  → 维度B：grep 缺失清单 → project_intent 补齐业务源文件 → 复扫验证
  → 维度C：check_file_size 超限清单 + tsc 类型/未使用检查 + 导出调用方统计
  → 复检：tsc --noEmit + @intent 覆盖重扫（修复前后对比）
  → 报告：.intentflow/codebase-health-check/report.md
```

依赖方向：全部复用现有 src/ 能力，**零新增依赖边**，不改变任何现有模块间依赖关系。

## 3. 测试策略

全部检查维度为 **直接模式**（输出可用命令/肉眼/类型系统直接验证），无隔离 TDD——本次零新增代码，无注入点设计。

| 维度 | 验证方式 | 验证命令/操作 | 预期结果 |
|---|---|---|---|
| A 架构 | 工具输出 + grep 复核 | `trace_dependency_chain` 对每层入口执行；`grep -rn "from '.*data" adapter/` 复核跨层 | 依赖清单按同层/跨层分组；跨层 import 全部可判定合规或列入问题 |
| B @intent | 修复前后对比 | `grep -L "@intent"` 全量扫描 | 业务源文件缺失数 9 → 0 |
| C 质量 | 类型系统 + 统计 | `npx tsc --noEmit`；`wc -l` 统计 | 修复后 tsc 零错误；>400 行清单完整列出 |
| 报告 | 结构核对 | 阅读 report.md | 含问题清单/修复记录/剩余风险三部分 |

**Mock 边界**：无（不新增代码，不涉及 mock）。

## 4. 本次设计决策

### 决策 1：零新增常驻代码
- 本次体检由 AI 协作者直接执行：复用 intent-flow MCP 工具（trace_dependency_chain / check_file_size / project_intent）+ 静态命令（find / grep / wc / tsc）
- **理由**：需求全部检查项均可由现有能力覆盖；无持续运行诉求（非"可重复脚本"需求）；新增代码违背"零新增依赖"取向
- **约束**：设计产出 = 检查维度清单 + 判定标准 + 执行顺序，即为执行蓝图

### 决策 2：@intent 修复三分法
| 类别 | 数量 | 处理 |
|---|---|---|
| 业务源文件 | 9 | **必补**（覆盖率目标 100% 的主体） |
| 测试文件 | 4 | **建议补**（需求规则"不强制"，补后全量覆盖率达标，报告归为建议项） |
| .d.ts 声明文件 | 2 | **不补**（类型声明无职责逻辑，@intent 无语义载体） |

### 决策 3：webview 子项目归类
- `adapter/vscode/ui/webview/src/` 为独立 Vue 应用（独立 tsconfig/package.json/vite）
- 处理：纳入 @intent 与文件大小扫描，但**不适用三层依赖判定**（无 data/application/adapter 结构）；检查结果在报告中单独归类

### 决策 4：文件大小只报告不拆
- `check_file_size` 默认 400 行阈值，超限文件列入报告问题清单并给出拆分建议
- 拆分属结构性重构，按需求边界收束延后，不做自动拆分

### 决策 5：死代码检查以 tsc + 调用方统计双重确认
- `tsc --noEmit`（noUnusedLocals 已开启）捕获未使用声明
- 未使用导出（公共 API 无调用方）用 grep 统计调用处，确认后列入报告；**删除动作仅限确认无调用方的导出**，签名类保留项走下划线惯例（对齐 unused-code-cleanup 决策 3）

### 决策 6：报告固定三部分结构
问题清单（按严重度排序：架构 > @intent 缺失 > 代码质量）→ 修复记录（改了什么、怎么改）→ 剩余风险（未修项 + 理由）

### 关键接口约束
1. 不改变任何现有模块间依赖方向（零新增依赖边）
2. 不修改接口签名（IFileRepository/ICodeParserRepository 等）；@intent 补齐只增注释，不改行为
3. 每个修复动作前先读文件确认上下文，避免盲改
4. 修复后必须 `tsc --noEmit` 复检，任何类型错误回滚该文件修复

## 5. 改动点清单

### 修改文件（预计 13 个 @intent 补齐 + 执行期发现项）

| # | 文件 | 改动 |
|---|---|---|
| 1-9 | 业务源文件（9 个，见附录） | 补齐 @intent 注释 |
| 10-13 | 测试文件（4 个） | 补齐 @intent（建议项） |
| 执行期 | 维度 C 发现项 | 死代码删除 / 报告问题，按决策 5 处理 |

### 新增文件
| 文件 | 内容 |
|---|---|
| `.intentflow/codebase-health-check/report.md` | 综合诊断报告（问题清单/修复记录/剩余风险） |

### 新增 src 代码
无。

## 6. 批次规划（只读 → 写 → 复检 → 报告）

1. **批次 1（只读检查）**：收集清单 + 维度 A/B/C 全量检查，产出问题清单初稿，**不写任何文件**
2. **批次 2（修复）**：按严重度执行修复（@intent 补齐 → 死代码删除），每个文件先读后改
3. **批次 3（复检）**：`tsc --noEmit` + @intent 覆盖重扫 + 文件大小重扫，确认无回归
4. **批次 4（报告）**：落盘 report.md，三部分结构

## 附录：缺失 @intent 业务源文件清单（9 个）

- `src/data/entities/DryRunConfig.ts`
- `src/data/entities/DryRunRecord.ts`
- `src/data/repositories/DryRunRepository.ts`
- `src/data/services/codeContext/extractors/FunctionCallExtractor.ts`
- `src/data/services/codeContext/extractors/TypeReferenceExtractor.ts`
- `src/data/services/codeContext/searchers/TypeDefinitionSearcher.ts`
- `src/data/services/DryRunStatisticsService.ts`
- `src/data/services/scope/index.ts`
- `src/adapter/vscode/ui/webview/src/renderer/leafer/components/selection-box/index.ts`
