# 设计文档：编译错误修复（compile-error-repair）

> 基于 `.intentflow/compile-error-repair/requirement.md`。已有项目，顺应原有结构（IntentFlow 三层 + webview 独立构建域），本次改动不改变任何依赖方向。

## 0. 设计前置验证结论

| 验证项 | 结论 |
|---|---|
| webview 源码被 adapter/application 引用？ | 无（exclude 安全） |
| application/index.ts 被谁 import？ | 全项目无人 import（删死导出安全） |
| pi-tui 真实来源 | pi-coding-agent 的嵌套依赖（^0.82.1），根 node_modules 无此包 |
| test mock 错误模式 | 双泛型 `vi.fn<[T], R>()`（TS2558 × 12）+ 缺 `Mocked<T>` 类型（TS2339 × 57）+ lambda 隐式 any（TS7006 × 1） |

## 1. 模块清单

| 模块 | 层级归属 | 本次改动 |
|---|---|---|
| `src/adapter/vscode/ui/webview/` | adapter（前端独立构建域） | 不直接改；从根 tsc 编译范围排除 |
| `tsconfig.json`（根） | 构建配置 | exclude 补 webview/src |
| `package.json` | 依赖声明 | devDependencies 补 pi-tui |
| `src/adapter/pi/tui/*`（6 文件） | adapter | 不修改代码，仅受益于依赖补齐 |
| `src/application/useCases/ProjectIntentUseCase.test.ts` | application（测试） | mock 类型写法升级 |
| `src/application/index.ts` | application | 删 2 行死导出 |
| `src/adapter/vscode/ui/CapabilityMapPanel.ts` | adapter | 删 4 处意图包残留引用 |

## 2. 依赖链

```
根 tsc 编译域：adapter(cli/mcp/pi/vscode) + application + data
    ↑ exclude 隔离
webview 独立构建域（vite + 自身 tsconfig：DOM lib + @core/@resource paths）

pi adapter TUI → @earendil-works/pi-tui（本次补根依赖声明，与 pi-coding-agent 版本对齐）
```

本次改动不改变任何跨层依赖方向，只修复"根 tsc 错误地编译了不属于它的构建域"与"依赖未声明"两类配置问题。

## 3. 本次设计决策

### 决策 1：webview 编译隔离（方向 2）
- **方案**：根 `tsconfig.json` 的 `exclude` 追加 `"src/adapter/vscode/ui/webview/src"`（vite.config.mts 已在排除中）
- **理由**：webview 有独立 tsconfig（DOM lib + paths 别名）与 vite 构建链，根 tsc 编译它是配置错误；已验证无任何 adapter/application 代码引用 webview/src，排除零副作用
- **约束**：webview 自身 tsconfig/vite 配置一律不动

### 决策 2：pi-tui 依赖声明（方向 3）
- **方案**：`npm install @earendil-works/pi-tui@^0.82.1`，声明到 **devDependencies**（与 pi-coding-agent 的存放位置一致）
- **理由**：pi-tui 是 pi 生态开发期依赖；版本 `^0.82.1` 与 pi-coding-agent 的依赖声明完全对齐
- **执行期修正（用户确认）**：安装暴露存量 peer 冲突——vitest@4.1.9 要求 `@types/node@^20/^22/>=24`，根声明 `^18` 不满足；经用户确认将 `@types/node` 升级至 `^22.20.1`（node 22 活跃 LTS，兼容性中间值），冲突解除
- **风险标注**：若 vsce 打包 pi adapter 时排除了 devDependencies 且 pi-tui 为运行时必需，需在打包验证阶段确认（记入 later-on.md）

### 决策 3：test mock 类型修复模式（方向 1，70 错误）
- **方案**（三处改动，语义零变化）：
  1. `createMockFileRepo(): IFileRepository` → 返回类型改 `Mocked<IFileRepository>`（vitest 导出类型，需 `import type { Mocked } from 'vitest'`）→ 消除 57 个 TS2339
  2. 12 处 `vi.fn<[T], R>()` 双泛型 → 单函数签名泛型 `vi.fn<(args...) => R>()` → 消除 12 个 TS2558
  3. 478 行 `filter(l => ...)` lambda 补显式类型标注 → 消除 TS7006
- **理由**：vitest 4.x 的 `vi.fn` 泛型为函数签名单参数；`Mocked<T>` 使 mock 对象属性携带 mock 方法类型
- **约束**：只改类型相关代码，断言/用例/期望值零改动；vitest 结果必须保持 29/29

### 决策 4：CapabilityMapPanel 残留删除边界（方向 4）
- **方案**：删除 `case 'saveGroups':` 整个分支（含 intentHashService + intentPackageRepo.save），删除另外 2 处 `intentPackageRepo.load` 调用（含其局部变量与 try/catch）
- **理由**：4 处引用均为意图包废弃功能残留，删除后该面板的意图包交互全部失效（符合废弃现状）
- **约束**：webview 侧的 saveGroups 消息发送点**本次不动**（vite 不做类型检查，不影响编译目标；运行时走 default warn 分支）；面板其余功能（意图详情等）不受影响

### 决策 5：application/index.ts 死导出删除（方向 5）
- **方案**：删除 `export * from './hooks'` 与 `export * from './config'` 两行
- **理由**：两模块不存在且全项目无人 import 本文件；`export * from './useCases'` 保守保留（未来统一出口策略待定）

### 关键接口约束
1. 每个方向完成后 tsc 错误数必须下降（验证判据 = 错误数单调递减至 0）
2. 不新增任何"以防万一"的兜底代码

## 4. 改动点清单

### 修改文件（5 个）

| # | 文件 | 改动 |
|---|---|---|
| 1 | `tsconfig.json` | exclude 追加 `src/adapter/vscode/ui/webview/src`（-24） |
| 2 | `package.json` + lockfile | devDependencies 追加 `@earendil-works/pi-tui@^0.82.1`（-6） |
| 3 | `src/application/useCases/ProjectIntentUseCase.test.ts` | Mocked 返回类型 + vi.fn 单泛型 ×12 + lambda 标注（-70） |
| 4 | `src/application/index.ts` | 删 2 行死导出（-2） |
| 5 | `src/adapter/vscode/ui/CapabilityMapPanel.ts` | 删 saveGroups 分支 + 2 处 load（-4） |

### 新增文件
无

## 5. 批次规划（错误数单调递减）

| 批次 | 内容 | 错误数 |
|---|---|---|
| 1 | tsconfig exclude webview/src + tsc | 112 → 88 |
| 2 | application/index.ts 删 2 行 + tsc | 88 → 86 |
| 3 | CapabilityMapPanel 删残留 + tsc | 86 → 82 |
| 4 | npm install pi-tui + tsc | 82 → 76 |
| 5 | test mock 类型修复（Mocked + 单泛型 + lambda） | 76 → 0 |
| 6 | 全量回归：tsc 零错误 + vitest 29/29 + webview vite 构建 + CLI/pi 冒烟 | — |

## 6. 验证策略

- **每批次**：`npx tsc --noEmit` 错误数对比（与上一批次比，单调递减；与基线 112 比，最终为 0）
- **批次 6 回归**：
  - `npm test`（vitest）29/29 —— 证明测试语义未变
  - webview 构建：`cd src/adapter/vscode/ui/webview && npm run build`（vite）成功 —— 证明独立构建域正常
  - 冒烟：`npx tsx src/adapter/cli/index.ts check-file-size src/data/entities/index.ts` 正常输出
  - pi 冒烟：`npx tsx -e "import('@earendil-works/pi-tui')"` 模块可解析
