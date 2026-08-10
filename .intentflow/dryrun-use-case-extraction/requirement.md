# 需求文档：DryRun 用例下沉（dryrun-use-case-extraction）

## 项目意图
将 DryRunManager 中的业务逻辑下沉到 application 层，消除 vscode adapter 对 data 层的直接依赖，恢复 adapter → application → data 的依赖方向。

## 功能清单
1. **DryRunUseCase 下沉**：application 层新增 DryRun UseCase，封装状态切换、统计计算、记录创建、持久化逻辑
2. **DryRunManager 瘦身**：adapter 层 DryRunManager 仅依赖 UseCase，不再直接 import data 层
3. **实体类型 re-export**：DryRunConfig / DryRunRecord 类型经 UseCase 暴露，adapter 不直接引用 data/entities

## 核心功能

### 核心功能1：DryRun 用例下沉
- **能力**：系统能够在 application 层提供 DryRun 用例（切换开关、拦截并记录、查询状态），内部使用 DryRunRepository 与 DryRunStatisticsService
- **业务价值**：业务逻辑归位 application 层，data 层实现可替换，adapter 只做 UI 编排

### 核心功能2：依赖方向修正
- **能力**：系统能够保证 vscode adapter 的 DryRun 相关代码（DryRunManager、ToggleDryRunCommand）只依赖 application 层 UseCase，不直接触碰 data 层
- **业务价值**：跨层依赖消除，架构规则可机械验证（grep 断言）

## 业务规则

### 依赖方向规则
- **场景**：vscode adapter 中任何 DryRun 相关代码
- **行为**：只允许 import `application` 层（UseCase）与 `adapter` 层内部模块；禁止 import `data/repositories`、`data/services`、`data/entities`（实体类型经 UseCase re-export 获取）
- **异常处理**：架构检查（grep）发现违规 import 视为构建失败

### 逻辑归属规则
- **场景**：DryRun 记录的产生与统计
- **行为**：统计计算（statisticsService.calculate）、记录创建（createDryRunRecord）、持久化（repository.save）全部在 UseCase 内完成；adapter 仅负责监听器通知、UI 状态同步、错误降级展示
- **异常处理**：保存失败时 UseCase 抛出错误，adapter 监听器降级到控制台输出（保持现状行为）

## 预设测试

### 前置条件
- `npm run compile` 编译通过
- VS Code 扩展开发宿主环境（验证 UI 回归）

### 测试步骤

1. **架构检查**：`grep -rn "data/" src/adapter/vscode/application/dryrun/DryRunManager.ts`
   **预期结果**：无任何 `data/` import；仅引用 application 层 UseCase

2. **编译验证**：`npx tsc --noEmit`
   **预期结果**：无类型错误（ToggleDryRunCommand、DryRunOutputChannel、DryRunStatusBarItem 均通过新 API 工作）

3. **行为回归（VS Code 手动）**：命令面板执行 "IntentFlow: Toggle Dry Run Mode" 两次
   **预期结果**：状态栏项切换显示；开关状态正确翻转

4. **拦截链路回归（VS Code 手动）**：dry-run 开启后执行一次文件保存（如保存文件触发拦截路径）
   **预期结果**：输出通道显示保存结果；dry-run 目录生成记录文件；关闭后不再拦截

### 异常场景

- **UseCase 接口设计不当导致 adapter 逻辑泄漏**：监听器/错误降级逻辑被塞进 UseCase → 回退：UseCase 只做纯业务（状态 + 记录），通知/展示保持 adapter 侧
- **行为差异**：重构后拦截链路行为与重构前不一致 → 以重构前行为为基准逐环节对照（toggle → 统计 → 记录 → 保存 → 通知）

## 边界收束

**此时必做**：
- DryRunUseCase 下沉（缺少则跨层依赖无法消除）
- DryRunManager / ToggleDryRunCommand 依赖修正

**此时不做**：
- DryRunOutputChannel / DryRunStatusBarItem 的 UI 重构 — UI 结构无跨层问题，仅保证其编译通过；条件：UI 本身有需求时再动
- DryRunRecord 持久化格式变更 — 数据格式与迁移无关；条件：出现格式需求时单独评估
- data 层 DryRunRepository / DryRunStatisticsService 的内部实现改造 — 本 feature 只改依赖方向，不动实现；条件：有性能/可靠性需求时单独评估

## 实现取向

- **UseCase 形态**：新增 `src/application/useCases/DryRunUseCase.ts`（单例或经 CoreDIContainer 装配），提供 `toggle() / isEnabled() / intercept(role, systemPrompt, userMessage) / onStateChange / onIntercept / onError` 能力；监听器机制随逻辑一并下沉（状态通知属于业务状态机的一部分）
- **DryRunManager 改造**：保留类名与单例形态（减少 UI 侧改动面），内部持有 UseCase 替代直接依赖 repository/statistics/entities
- **类型暴露方式**：`DryRunUseCase.ts` 内 `export type { DryRunConfig, DryRunRecord }` re-export，adapter 侧改 import 源
- **装配方式**：UseCase 实例在 `CoreDIContainer` 中创建（与现有用例一致），adapter 经 container 获取；DryRunManager 保持自身单例，构造时从 CoreDIContainer 取 UseCase
