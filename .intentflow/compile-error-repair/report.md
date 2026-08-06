# compile-error-repair 关账报告

## 1. 项目概览

修复 src 全量 `tsc --noEmit` 的 112 个既有编译错误（5 个方向），恢复"tsc 零错误"编译标准，消除对后续所有 feature 验证的干扰。

## 2. 计划 vs 实际

| 计划功能 | 状态 | 说明 |
|---|---|---|
| 方向 2：webview 编译隔离（tsconfig exclude） | ✅ 完成 | 1 行配置，清除 29 个错误（比预期 24 多 5 个） |
| 方向 5：application/index 死导出 | ✅ 完成 | 删 2 行，-2 |
| 方向 4：CapabilityMapPanel 意图包残留 | ✅ 完成 | 删 saveGroups 分支 + 2 处 load + 1 处 shorthand 修复，-4 |
| 方向 3：pi-tui 依赖声明 | ✅ 完成 | 安装 ^0.82.1 + **@types/node 升级 ^22（用户确认）**，-6 |
| 方向 1：test mock 类型修复 | ✅ 完成 | Mocked 类型 + 12 处单泛型 + 1 处 lambda，-70 |
| 每批次 tsc 验证（错误数单调递减） | ✅ 完成 | 112 → 82 → 80 → 76 → 70 → 0 |
| 全量回归 | ✅ 完成 | tsc 零错误 + vitest 29/29 + webview build + CLI/pi-tui 冒烟 |

## 3. 关键决策

1. **@types/node ^18 → ^22.20.1（用户确认）**— 安装 pi-tui 暴露存量 peer 冲突：vitest@4.1.9 要求 @types/node ^20/^22/>=24，根声明 ^18 不满足。npm 装新包时完整重解析暴露了它。经用户确认升级至 ^22（node 22 活跃 LTS，兼容性中间值），冲突解除。
2. **webview 排除采用"src 目录级"而非"文件级"** — exclude 追加 `webview/src` 整体，实际清除 29 个错误（比按文件预估的 24 多，因 interaction.ts 单文件 8 个错误），一网打尽。
3. **CapabilityMapPanel 删除边界** — 除设计定的 4 处引用外，第 2 处删除后 `groups,` shorthand 仍引用已删变量（TS18004），补 `groups: []` 修复；postMessage 的 groups 字段统一置空数组（意图包已无数据来源）。
4. **test mock 修复采用 `Mocked<IFileRepository>` 而非 `vi.mocked()` 逐点包裹** — 后者需改 57 处调用点，前者只改 1 处返回类型 + 12 处泛型，改动面最小且语义零变化。

## 4. 经验记录

### 有效做法
- **错误数单调递减判据**：每批次 `tsc | wc -l` 对比上一批次，方向性清晰；最终目标 0 可预期。
- **diff 基线双向检查**：每批次不仅看"少了哪些"，还检查 `^>` 行确认"无新增错误"——防止修 A 破 B。
- **依赖冲突先查"存量 vs 新增"**：npm ERESOLVE 时先看 eresolve-report 定位冲突双方，发现是存量冲突（vitest 与 @types/node 18）而非 pi-tui 本身问题，避免误判。
- **webview 构建验证用 `npx vite build` 直跑**：webview 无 build script，直接调 vite 验证独立构建域。

### 踩坑
- **npm install 新包会暴露存量依赖树冲突**：之前项目能正常 install，不代表依赖树健康；@types/node 18 与 vitest 4 的 peer 冲突一直存在，只是从未触发重解析。
- **shorthand 属性在删除局部变量后残留**：删 `const groups = ...` 后 `groups,` 未同步改，产生 TS18004（非预期错误，tsc 立即捕获）。

### 工具反馈
- 无（本次工具链表现正常）

## 5. 后续待办

### 立即跟进
- 无（5 方向全部完成，tsc 零错误已达成并回归验证）

### 长期备忘
- `.intentflow/compile-error-repair/later-on.md`（D:\w_dev\IntentFlow\.intentflow\compile-error-repair\later-on.md）：
  1. CapabilityMapPanel 的 webview 侧意图包消息发送点清理（vite 不查类型，本次未动）
  2. pi-tui 运行时打包验证（vsce package 时确认 devDependencies 是否够用）
  3. application/index.ts 整体存废（全项目无人 import）
  4. tsc 零错误后加 `typecheck` 脚本并接入 CI 防回归
  5. vi.fn 单泛型写法的测试约定
  6. webview 独立 tsconfig 纳入 project references 的评估

## 6. 开发工作流反馈

- **流程断点**：requirement 阶段对"依赖安装类"任务缺少"可能暴露存量依赖树冲突"的预判模板，本次靠执行期异常处理（停下问用户）兜住。建议 requirement 对涉及 npm install 的 feature 增加依赖树健康检查步骤。
- **工具链瓶颈**：npm ERESOLVE 报告阅读成本高（链式依赖展示），但 eresolve-report 文件定位根因有效，可作为标准排查路径沉淀。
- **skill 建议**：本次"错误数单调递减 + 双向 diff"的批次验证法已是第二次使用（interface-layer-reorg 用过基线对比），可沉淀为 execute skill 中删除/修复型 feature 的标准验证模板。

## 7. 结论

- **当前状态：可发布** — 112 个基线错误全部清除（tsc 零错误），vitest 29/29 语义未变，webview 独立构建域正常，CLI/pi-tui 冒烟通过；依赖基线变更（pi-tui + @types/node ^22）经用户确认。
- **建议下一步**：按 later-on.md 第 4 条，将 `"typecheck": "tsc --noEmit"` 加入 package.json scripts 并接入 CI/发布前检查，锁定本次成果；随后可回到 interface-layer-reorg 的 later-on 清单（DependencyInfo 重命名消歧等）。
