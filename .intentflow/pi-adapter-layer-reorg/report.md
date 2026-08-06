# pi-adapter-layer-reorg 关账报告

## 1. 项目概览
消除 pi 适配层（src/adapter/pi）全部跨层依赖，通过实现类下沉（SubSkillRepository → data、ScopePolicy → application）与接口上移（ISubProcessRunner → application）恢复 adapter → application → data 的严谨分层，根治 repositories/services 命名冲突。

## 2. 计划 vs 实际

| 计划功能 | 状态 | 说明 |
|---------|------|------|
| SubSkillRepository 下沉 data 层 | ✅ | `data/services/agent/SubSkillRepository.ts`（git mv 保留历史） |
| ScopePolicy 下沉 application 层 | ✅ | `application/services/ScopePolicy.ts`，与 IAccessPolicyService 同目录 |
| ISubProcessRunner 接口上移 application | ✅ | `application/services/ISubProcessRunner.ts`，附带 re-export AgentRunResult/AgentUsage |
| 实体类型经 application 透出 | ✅ | 新建 `application/services/agentRepository.ts`；SCOPE_SKIP_ENV 经 IAccessPolicyService 透出 |
| 删除 repositories/services 空文件夹 | ✅ | 两目录已删除 |
| 引用方同步修正 | ✅ | DIContainer、index.ts、runtime ×2、tools ×3、测试、README、data/repositories/index.ts、SpawnAgentUseCase |
| @intent 投射 | ✅ | 10 处（4 新位置 + 6 更新，含 ToolAccessGuard 过时表述顺带修正） |
| 集成验证 | ✅ | grep 清零 + tsc + 全量测试 74 条 + compile:pi 构建 + 容器冒烟测试 5 条 |

全部完成，无未做项。

## 3. 关键决策

- **CoreDIContainer 非单例的适配**：设计文档假设 `getInstance()`，实现发现 CoreDIContainer 是普通类（无静态单例）。改为与 CliDIContainer 一致的 `private core = new CoreDIContainer()` 持有实例模式——实现细节偏离，架构意图不变。
- **git mv --force 覆盖 @intent 空文件**：阶段一先投射 @intent 到目标路径（project_intent 自动创建文件），随后 git mv --force 移动源文件覆盖了空文件，导致 3 处 @intent 需二次投射。流程浪费一轮，但结果正确。
- **冒烟测试保留为常驻测试**：`dicontainer.smoke.test.ts` 锁定本次重构的核心行为（组装来源、策略生效、常量透出），环境无关（~/.pi/agent 缺失时 discoverAll 静默返回空），有回归价值，保留。
- **ISubProcessRunner re-export 修正**：首版误将 AgentUsage 从 AgentRunResult 文件 re-export（独立实体文件），tsc 捕获后修正为独立 re-export。

## 4. 经验记录

- **有效做法**：
  - 实现类归属判定准则（是否依赖平台 API）可复用到后续分层规整：依赖平台 → 接口上移；纯数据 → 实现下沉
  - grep 机械化验证（`grep -rn "from '.*data/" src/adapter/`）一跑即知分层是否合规，成本极低
  - 类型透出用"独立文件 + 同域 re-export"组合：独立文件避免 useCase 职责混合，同域 re-export 让类型跟随所属域
- **踩坑**：
  - tsx 直接运行 DIContainer 会因 pi 平台包 exports 限制失败（`ERR_PACKAGE_PATH_NOT_EXPORTED`），冒烟验证应直接写 vitest 测试而非临时 tsx 脚本
  - project_intent 创建空文件与 git mv 的先后顺序需规划：应先 git mv 再投射，或投射后不依赖 mv 覆盖
- **工具反馈**：
  - intent-flow_project_intent 的 force 模式工作良好，@intent 替换保留其余内容符合预期

## 5. 后续待办

- **立即跟进**：无（全部计划项完成，验证全绿）
- **长期备忘**：见 `.intentflow/pi-adapter-layer-reorg/later-on.md`（绝对路径：`D:/w_dev/IntentFlow/.intentflow/pi-adapter-layer-reorg/later-on.md`）
  - mcp（CheckFileSizeTool）与 vscode（DryRunManager）适配层同类跨层，可复用本 feature 验证方式
  - IAccessPolicy（data）疑似闲置重复接口，待清理确认
  - README 声称的 SubSkillRepository 测试实际缺失，建议补 `data/services/agent/SubSkillRepository.test.ts`
  - 分层验证可脚本化（npm script + CI）

## 6. 开发工作流反馈

- **流程顺畅点**：requirement（决策拍板）→ design（归属判定准则）→ execute（直接模式）→ report 全链路无断点；本次为纯重构，execute 的"直接模式"判定准确命中，未浪费 TDD 开销
- **结构性建议**：execute 阶段一"project_intent 先于文件移动"的时序若与 git mv 冲突，建议 skill 补充说明——涉及文件移动时先 mv 再投射 @intent，或允许 git mv --force 后二次投射（本次已实践验证可行）
- **工具链瓶颈**：无

## 7. 结论

- **当前状态**：可发布。验证矩阵全绿：跨层 grep 清零、tsc 无错、全量测试 74/74、compile:pi 构建成功、容器冒烟 5/5
- **建议下一步**：按 later-on 备忘推进——优先补 SubSkillRepository 测试（README 声称存在但缺失），其次评估 mcp/vscode 适配层的同类规整
