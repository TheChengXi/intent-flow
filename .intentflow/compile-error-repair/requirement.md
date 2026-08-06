# 需求文档：编译错误修复（compile-error-repair）

## 项目意图

修复 src 全量 `tsc --noEmit` 的 112 个既有编译错误（5 个方向），恢复"tsc 零错误"编译标准，消除对后续所有 feature 验证的干扰。

## 功能清单

1. **webview 编译隔离**：根 tsconfig `exclude` 补 `src/adapter/vscode/ui/webview/src`（24 个错误：DOM lib 缺失 + @core/@resource 别名无法解析）
2. **pi-tui 依赖声明**：安装 `@earendil-works/pi-tui@^0.82.1` 到根依赖（6 个错误；该包现为 pi-coding-agent 嵌套依赖，项目代码解析不到）
3. **测试 mock 类型修复**：ProjectIntentUseCase.test.ts 70 个错误（TS2339 mockResolvedValue × 61 + TS2558 vi.fn 泛型 × 12）
4. **意图包残留引用清理**：CapabilityMapPanel.ts 4 处废弃引用（intentPackageRepo / intentHashService）
5. **死导出清理**：application/index.ts 2 行死 import（./hooks、./config）

## 核心功能

### 核心功能1：编译配置修复
- **能力**：系统能够通过修正 tsconfig 与依赖声明，使 webview（vite 构建域）与 pi-tui（pi 生态依赖）不再产生编译错误
- **业务价值**：webview 保持独立构建域（DOM lib + 别名），pi TUI 组件获得正确的依赖解析

### 核心功能2：测试类型错误修复
- **能力**：系统能够将 ProjectIntentUseCase.test.ts 的 mock 写法升级为与当前 vitest 版本兼容的类型写法，且不改变任何测试语义
- **业务价值**：测试文件恢复类型检查，避免 mock 写法误导后续维护

### 核心功能3：废弃残留清理
- **能力**：系统能够删除 vscode UI 与 application 入口中指向已废弃/不存在模块的引用
- **业务价值**：与 interface-layer-reorg 一脉相承的废弃清理，消除误导性代码

## 业务规则

### 编译隔离规则（方向 2）
- **场景**：根 tsconfig 编译 src 全量时
- **行为**：webview/src 必须排除在根 tsc 之外（其由独立 tsconfig + vite 构建）；webview 自身 tsconfig 已含 DOM lib 与 paths 别名，不动
- **异常处理**：排除后若 webview 仍有代码被根 tsc 引用（如被 adapter 侧 import），恢复并单独处理

### 依赖版本对齐规则（方向 3）
- **场景**：安装 pi-tui 依赖
- **行为**：版本与 pi-coding-agent 的依赖声明对齐（^0.82.1），仅补根依赖声明，不改任何 import 代码
- **异常处理**：npm 安装失败（私有包源问题）→ 评估从 pi-coding-agent 嵌套位置拷贝/提升，或向用户确认 registry 配置

### 测试语义不变规则（方向 1）
- **场景**：修改 ProjectIntentUseCase.test.ts 类型写法
- **行为**：只改 mock 类型标注与 vi.fn 泛型写法，不改任何断言、用例结构与期望值；vitest 运行结果必须与修复前一致（29/29）
- **异常处理**：修复后测试失败 → 回滚该处改动，单独分析

### 验证判据
- **场景**：每完成一个方向后
- **行为**：`npx tsc --noEmit` 错误数必须下降且不新增其他错误；全部完成后 tsc 必须**零错误**
- **异常处理**：错误数不降反升 → 停止该方向，回查改动

## 预设测试

> 从用户视角可执行的测试步骤，验证功能是否符合预期。

### 前置条件
- Node.js + 依赖已安装
- 已知基线：112 个编译错误（interface-layer-reorg 关账后实测）

### 测试步骤

1. **[全量编译]**：运行 `npx tsc --noEmit`
   **预期结果**：零错误，退出码 0

2. **[单元测试]**：运行 `npm test`（vitest run）
   **预期结果**：29/29 通过（与修复前一致，证明测试语义未变）

3. **[webview 构建]**：在 `src/adapter/vscode/ui/webview` 下运行 `npm run build`（或 vite build）
   **预期结果**：构建成功，证明排除根 tsc 后 webview 独立构建域正常

4. **[pi 冒烟]**：运行任意 pi adapter 命令（如 `npx tsx src/adapter/pi/index.ts` 或 TUI 相关入口）
   **预期结果**：正常加载，无模块解析错误

5. **[CLI 冒烟]**：运行 `npx tsx src/adapter/cli/index.ts check-file-size src/data/entities/index.ts`
   **预期结果**：正常输出（上一 feature 修复的命令表保持正常）

### 异常场景

- **[依赖安装失败]**：pi-tui 无法从 registry 安装 → 停下与用户确认源配置，不擅自换版本
- **[测试变红]**：mock 写法修复导致测试失败 → 回滚该处，确认是语义被改还是基线本就红
- **[webview 构建破坏]**：exclude 后 webview vite 构建失败 → 检查是否有 adapter 侧对 webview 源码的 import，恢复并另行处理

## 边界收束

**此时必做**：
- 方向 2（tsconfig exclude，24 错误）
- 方向 5（application/index 死导出，2 错误）
- 方向 4（CapabilityMapPanel 残留，4 错误）
- 方向 3（pi-tui 依赖，6 错误）
- 方向 1（test mock 类型，70 错误）
- 收尾：tsc 零错误 + vitest 29/29 + 冒烟

**此时不做**：
- webview 源码内部质量改进（如类型收紧、组件重构）— 其由独立构建域管理，本次只做编译隔离
- pi-tui 运行时行为问题排查 — 本次只解决模块解析，运行期问题需在 pi 生态侧验证
- CapabilityMapPanel 的更深层重构（如删除废弃面板）— 本次只删编译错误指向的引用
- 修复过程中发现的其他废弃代码 — 超出本 feature 对象（编译错误），另立 feature

## 执行批次规划

| 批次 | 内容 | 预期错误变化 |
|---|---|---|
| 1 | 方向 2：tsconfig exclude webview/src | 112 → 88 |
| 2 | 方向 5：application/index.ts 删 2 行死 import | 88 → 86 |
| 3 | 方向 4：CapabilityMapPanel 删 4 处残留 | 86 → 82 |
| 4 | 方向 3：npm install pi-tui@^0.82.1 | 82 → 76 |
| 5 | 方向 1：test mock 类型修复（70 个，可细分） | 76 → 0 |
| 6 | 全量回归：tsc 零错误 + vitest + webview 构建 + 冒烟 | — |
