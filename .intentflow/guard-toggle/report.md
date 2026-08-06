# guard-toggle 关账报告

## 1. 项目概览

为 ToolAccessGuard 增加用户运行时可控的全局开关：`/guard-auto` 命令翻转状态，关闭后 edit/write/bash 不再弹确认框直接放行，状态持久化到 `.intentflow/guard-state.json`，重启保持。

## 2. 计划 vs 实际

- ✅ `/guard-auto` 斜杠命令 — GuardToggleCommand 实现并注册（extension.ts）
- ✅ 状态持久化 — GuardToggleStore 读写 `.intentflow/guard-state.json`，默认安全态回退
- ✅ 守卫放行逻辑接入开关 — ToolAccessGuard 放行条件 OR 扩展（shouldSkip ∨ 开关关闭）
- ✅ 切换状态提示 — 关闭 `warning` / 开启 `info` / 写失败 `error`
- ✅ 装配 — CoreDIContainer 组装 store+service，DIContainer 经 core 获取并注入
- ✅ 测试 — GuardToggleStore 13 用例 + GuardToggleService 9 用例 + 集成测试扩展 3 用例（两轮隔离 TDD VERDICT: PASS）

全部完成，无 ❌ 项。

## 3. 关键决策

- **notify 类型用 `'warning'` 而非 `'warn'`**：pi 类型定义是 `"info" | "warning" | "error"`。设计文档写"warn 级别"，实现时发现 `ClearSubagentCacheCommand` 因 `register(pi: any)` 逃过了类型检查才用了 `'warn'`；本 feature 用正确类型，设计语义不变
- **集成测试同步更新**：ToolAccessGuard 构造签名变化破坏了现有集成测试（TS2554），这是预期破坏，已重写测试文件并顺带补充"开关关闭 → edit/bash 放行"两条集成路径（真实 GuardToggleService + chdir 临时目录，符合文件"不 mock 策略层"风格）
- **fake store 需 `as unknown as` 桥接**：GuardToggleStore 含 private 成员（configPath），TS 结构类型无法直接赋值，测试用 unknown 桥接（记录于 test-report）
- **toggle 先翻内存再写盘**：严格按 @intent"写失败抛错但内存已翻转（本次会话生效）"，返回值取翻转后的内存值（code-report 决策点 2）

## 4. 经验记录

- **有效做法**：
  - 两轮隔离 TDD 各文件独立验证（13+9 用例），reviewer 先跑测试再对齐 @intent，PASS 判定明确
  - chdir(mkdtemp) 隔离模式在 data/application/集成三层测试中统一复用，不 mock 被测类
  - @intent 先行（阶段一）使规格冻结，实现阶段零规格漂移，三份子报告均确认"@intent 未改动"
- **踩坑**：
  - 骨架期 `tsc` 报"未使用变量"告警（TS6133/TS6138）属预期噪音，实现后自动消失
  - 构造签名变更会破坏依赖方测试——直接模式改动前应先全局 grep 消费方（本次靠 tsc 兜住，但先查更快）
- **工具反馈**：
  - spawn_agent 子 agent 报告自动落盘 `.intentflow/<feature>/logs/`，关账阶段直接聚合，链路顺畅

## 5. 后续待办

- **立即跟进**：无（实现与验证全部闭环）
- **长期备忘**：`.intentflow/guard-toggle/later-on.md`（绝对地址：D:/w_dev/IntentFlow/.intentflow/guard-toggle/later-on.md）— 含分规则开关、TUI 常驻组件、跨项目共享、CLI flag、写原子性、多进程并发等 10 项，均带触发条件

## 6. 开发工作流反馈

- requirement → design → execute → report 四阶段衔接顺畅，设计文档的"改动点清单"直接作为 execute 的投射清单，无信息损耗
- 改进建议：design 阶段对"修改已有文件"的破坏面（构造签名变更波及测试文件）可提前标注，execute 阶段可少一次 tsc 兜底循环

## 7. 结论

- **当前状态：可发布** — tsc 0 错误，7 个测试文件 89 用例全绿，@intent 规格与实现一致，无未完成项
- **建议下一步**：按需从 later-on.md 中评估分规则开关或 TUI 状态组件；若实际使用中发现误关风险，优先做"切换时安全确认"
