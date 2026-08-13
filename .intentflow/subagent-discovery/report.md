# subagent-discovery 关账报告

## 1. 项目概览

修复 sub-agent 发现链路：`AgentRepositoryImpl` 从「仅扫描全局 ~/.pi/agent/skills（目录不存在）」扩展为「全局 + 项目级 .pi/skills（cwd 向上查找至 git root）合并扫描」，支持 `(skillName, name)` 去重与 `name` / `skill/name` 两种名称解析，使 `list_agents` / `agent_chat` 能发现并调用工作区实际注册的 sub-agent。

## 2. 计划 vs 实际

- ✅ 多目录 sub-skill 发现（全局 + 项目级合并，项目级覆盖全局）— 完成，`scanSubSkillsRoots` + origin 标记
- ✅ 项目级目录定位（cwd 向上查找 `.pi/skills` 至 git root）— 完成，`resolveProjectSkillsDirs`（`.git` 文件/目录双形态兼容）
- ✅ 去重规则调整（(skillName, name) 键，跨 skill 同名共存）— 完成，`deduplicate` 键改造
- ✅ 路径式名称解析（`skill/name` 别名，裸名多命中 project 优先）— 完成，`findByName` 两级匹配
- ✅ 仓库层单测 — 完成，`AgentRepositoryImpl.test.ts` 8 项（含 cwd 向上查找与 git root 截断）
- ✅ 端到端验证 — 完成（真实工作区链路验证通过；当前会话为旧 bundle 快照，需重启 pi 会话最终确认）
- 🔸 隔离 TDD（test-writer / code-writer 子 agent）— 变通为主会话实现：子 agent 不可用正是本次修复对象（鸡生蛋），修复后后续 feature 可恢复标准流程

## 3. 关键决策

- **新增 `origin` 字段，不复用闲置的 `source: 'project_agent'`**：`source` 表达发现方式、`origin` 表达目录层级，正交清晰；origin 设为可选字段（user agents 扫描无层级概念，undefined 视为全局优先级），现有构造处零破坏
- **优先级依赖扫描顺序 + last-wins 去重**（全局先入、项目级后入），不额外排序——最小改动；`origin` 仅用于 findByName 多命中时的确定性选择
- **findByName 同级内取「发现列表第一个」**而非需求文档的「最后扫描到的」：`readdir` 顺序不可控，「最后」不可预测；已记录在 design.md 偏差1
- **resolveProjectSkillsDirs 放仓库内部**（不新开模块）：逻辑小、唯一使用者；options 扩展 `projectSkillsDirs` / `cwd` 供测试注入

## 4. 经验记录

- 有效做法 — 鸡生蛋场景的处理：当子 agent（test-writer/code-writer）依赖本次修复对象时，主会话承担测试编写并严格按 TDD 标准（每测试一关注点、测公开接口、真实临时目录不 mock 文件系统），修复后验证子 agent 可用性即可回归标准流程
- 有效做法 — 集成验证分层：单测（隔离目录）→ 真实工作区链路验证（临时 vitest 测试，生产无参构造）→ 部署产物验证（compile:pi + deploy:pi），三层递进，即使当前会话持旧 bundle 快照也能证明修复有效性
- 踩坑 — `npx tsx` 未安装会触发 npm 自动下载（污染输出且慢）；项目 vitest include 只覆盖 `src/**/*.test.ts`，临时验证脚本必须放 src 下（或直接用 vitest 跑）
- 工具反馈 — 当前会话的 pi 扩展工具（list_agents / agent_chat）是会话启动时快照，重新部署后需重启会话才能验证，导致端到端验证被拆成「逻辑验证 + 待重启确认」两段

## 5. 后续待办

- 立即跟进：**重启 pi 会话**后确认 `list_agents` 列出 `[execute]` 分组（test-writer / code-writer）、`agent_chat` 按 `test-writer` 与 `execute/test-writer` 均可调用（当前会话已验证仓库层链路，此为最终 UI 确认）
- 立即跟进：重启后可用 test-writer/code-writer 子 agent 回归标准隔离 TDD 流程（后续 feature 恢复）
- 长期备忘：`D:\w_dev\intent-flow\.intentflow\subagent-discovery\later-on.md` — L01 发现缓存/热重载、L02 项目信任机制联动、L03 monorepo 多级 .pi/skills 策略、L04 project_agent 枚举潜在用途、L05 name 含 '/' 边界

## 6. 开发工作流反馈

- 流程断点：execute skill 的隔离 TDD 强制路由未考虑「子 agent 本身不可用」的引导场景——当修复对象就是子 agent 依赖链本身时，无降级路径说明。建议 skill 补充「子 agent 不可用时主会话代写测试」的显式变通规则，避免每次现场判断
- 工具链瓶颈：扩展工具会话快照机制使「代码修复 → 端到端确认」存在重启间隙；若后续有 CI 级 pi 会话（`pi --mode rpc` 或非交互启动）可先于交互会话加载新 bundle，能消除该间隙
- 经验沉淀：`.pi/skills/requirement/SKILL.md` 的「实现对齐」演进（本次需求分析已按新规执行）与本次 feature 无关，未纳入提交，属 skill 独立演进

## 7. 结论

- 当前状态：**可发布**（仓库层 8/8 单测、全量 146×3 稳定性、真实工作区链路、全量编译 4 目标均通过；部署已完成）
- 建议下一步：重启 pi 会话做最终端到端确认（list_agents / agent_chat 两种名称）；确认后本 feature 关账闭环
