# 设计文档：DryRun 用例下沉（dryrun-use-case-extraction）

## 设计基线

**项目状态**：已有项目，遵循现有三层结构（adapter → application → data）。本次为依赖方向修正，业务行为零变化。

**设计范围**：
1. application 层新增 `DryRunUseCase`，承接 DryRunManager 的全部业务逻辑
2. DryRunManager 瘦身为薄委托，adapter 不再 import data 层
3. 实体类型经 UseCase re-export

---

## 模块清单

| 模块 | 层级归属 | 职责 | 依赖 |
|---|---|---|---|
| `IDryRunRepository`（新增，`src/data/repositories/IDryRunRepository.ts`） | data | 拦截记录持久化接口：`save(record, outputDir): Promise<string>`；**零 import**（不引入 vscode/fs） | — |
| `DryRunRepository`（改，`src/data/repositories/DryRunRepository.ts`） | data | `implements IDryRunRepository`；实现逻辑不动 | vscode（现状保留，见决策 5） |
| `DryRunUseCase`（新增，`src/application/useCases/DryRunUseCase.ts`） | application | 单例 + 构造器注入；`toggle() / isEnabled() / intercept() / onStateChange / onIntercept / onError`；持有 config（createDefaultConfig） | IDryRunRepository、DryRunStatisticsService、DryRunConfig/DryRunRecord（re-export） |
| `DryRunUseCase.test.ts`（新增，同目录） | application | 隔离 TDD 单测 | vitest |
| `VSCodeDIContainer`（改，`src/adapter/vscode/VSCodeDIContainer.ts`） | adapter/vscode | 装配 `dryRunUseCase`（激活预留容器，与注释"VSCode 特定用例"吻合） | CoreDIContainer（已有）、DryRunUseCase |
| `DryRunManager`（改，`src/adapter/vscode/application/dryrun/DryRunManager.ts`） | adapter/vscode | 薄委托：公开 API 不变（toggle/isEnabled/intercept/三个 on*），内部经 VSCodeDIContainer 取 UseCase 转发；不再 import data 层 | VSCodeDIContainer → DryRunUseCase |
| `ToggleDryRunCommand` / `DryRunOutputChannel` / `DryRunStatusBarItem`（**不改**） | adapter/vscode | 构造器注入 DryRunManager，API 面不变，零改动 | DryRunManager |
| `useCases/index.ts`（改） | application | 聚合导出 DryRunUseCase（与其他用例一致） | — |

---

## 依赖链

```
extension.ts
  └─ DryRunManager.getInstance()                    [adapter/vscode]
       └─ VSCodeDIContainer.getInstance().dryRunUseCase   [adapter/vscode, 单例]
            └─ DryRunUseCase                        [application, 单例]
                 ├─ IDryRunRepository（impl: DryRunRepository）  [data]
                 ├─ DryRunStatisticsService         [data, 纯计算零依赖]
                 └─ DryRunConfig / DryRunRecord     [data/entities]
UI 组件（OutputChannel/StatusBar/ToggleCommand）→ DryRunManager（委托，API 不变）
```

依赖方向全程合法：adapter → adapter → application → data，无跨层。

---

## 测试策略

| 模块 | 验证模式 | 依赖注入点 | 验证命令 |
|---|---|---|---|
| DryRunUseCase | [隔离 TDD] | **构造器注入** IDryRunRepository 与 DryRunStatisticsService（不在内部创建）；测试传 FakeRepository + 真实 statistics | `npx vitest run src/application/useCases/DryRunUseCase.test.ts` |
| DryRunManager 瘦身 | [直接模式] | 委托肉眼可验证 + 类型系统；VS Code 手动回归 | `npx tsc --noEmit` + 手动测试 |
| 架构检查 | [直接模式] | grep 断言 | `grep -rn "data/" src/adapter/vscode/application/dryrun/DryRunManager.ts` → 无结果 |

**Mock 边界**：只 mock 系统边界——FakeRepository 替代文件 IO 与 vscode workspace（`save` 捕获入参并返回假路径）；**不 mock** DryRunStatisticsService（零 import 纯函数，用真实实现）。监听器通知、toggle 状态翻转、失败降级路径均用真实逻辑断言。

**DryRunUseCase 单测断言点**（隔离 TDD）：
1. `toggle()` 翻转状态并触发 onStateChange 监听器（含监听器抛错不阻断）
2. `intercept()` 计算统计 → 创建记录 → 经注入 repository 保存（Fake 捕获 role/prompt/统计值）→ 触发 onIntercept
3. 保存失败 → 触发 onError 且携带完整降级内容（`# System Prompt ...` 格式）
4. `isEnabled()` 初始为 false

---

## 本次设计决策

### 决策 1：DryRunUseCase 装配进 VSCodeDIContainer，不进 CoreDIContainer
- **理由（关键约束）**：`DryRunRepository` 顶层 `import * as vscode from 'vscode'`。CoreDIContainer 被 MCP 服务器/CLI/pi 共用，若 DryRunUseCase 进 CoreDIContainer，非 vscode 构建链将引入 `require('vscode')` → 运行时崩溃
- **落脚点**：VSCodeDIContainer 是预留的 vscode 专属容器（注释明确"VSCode 特定用例（未来）"），语义吻合；激活后 DryRunManager 经它获取 UseCase，extension.ts 零改动

### 决策 2：IDryRunRepository 接口化
- **理由**：DryRunUseCase 需在 application 层依赖持久化能力；直接依赖具体类 DryRunRepository 会让测试与 application 层代码被迫加载 vscode import。接口放 `data/repositories/`（与 IFileRepository 同级模式），零 import
- **接口约束**：`save(record: DryRunRecord, outputDir: string): Promise<string>`；DryRunRepository 补 `implements`，实现不动

### 决策 3：DryRunManager 保留公开 API 薄委托
- **理由**：UI 三组件（OutputChannel/StatusBar/ToggleCommand）均构造器注入 DryRunManager 并调用 `toggle/isEnabled/onStateChange/onIntercept/onError`；保留 API 面 → 三组件与 extension.ts 零改动
- **监听器归属**：三类监听器机制随业务下沉至 UseCase（状态通知属业务状态机），DryRunManager 仅转发注册

### 决策 4：DryRunUseCase 单例 + 工厂注入双形态
- **形态**：`getInstance()`（生产，内部默认装配）与 `createDryRunUseCase(repository, statisticsService)`（工厂，测试注入点）；与 DryRunManager 现状单例形态一致
- **边界**：UseCase 内部持有 config（createDefaultConfig），intercept 失败降级内容构造（`# System Prompt ...` 格式）随逻辑下沉

### 决策 5：DryRunRepository 的 vscode 依赖保持现状
- **理由**：本 feature 只修 adapter → data 跨层依赖；vscode 依赖在 data 层内部，不影响依赖方向合法性
- **延后**：workspaceRoot 注入化记入 later-on

---

## 改动点清单

### 新增（3 个文件）

| 文件 | 内容 |
|---|---|
| `src/data/repositories/IDryRunRepository.ts` | 持久化接口（零 import） |
| `src/application/useCases/DryRunUseCase.ts` | 单例 + 工厂；toggle/intercept/监听器；类型 re-export（`export type { DryRunConfig, DryRunRecord }`） |
| `src/application/useCases/DryRunUseCase.test.ts` | 隔离 TDD 单测（FakeRepository + 真实 statistics） |

### 修改（4 个文件）

| 文件 | 改动 |
|---|---|
| `src/data/repositories/DryRunRepository.ts` | 补 `implements IDryRunRepository`（实现逻辑不动） |
| `src/adapter/vscode/VSCodeDIContainer.ts` | 新增 `public dryRunUseCase`，构造时装配 `new DryRunUseCase(new DryRunRepository(), new DryRunStatisticsService())`（或经工厂） |
| `src/adapter/vscode/application/dryrun/DryRunManager.ts` | 删除 data 层 import；构造时经 VSCodeDIContainer 取 UseCase；全部方法改为委托；监听器转发 |
| `src/application/useCases/index.ts` | 聚合导出 DryRunUseCase |

### 不改

- `extension.ts`、`ToggleDryRunCommand`、`DryRunOutputChannel`、`DryRunStatusBarItem`（API 面不变）
- `CoreDIContainer`（避免非 vscode 构建链污染，见决策 1）
- `DryRunConfig` / `DryRunRecord` / `DryRunStatisticsService`（纯实体/纯函数，零改动）
