# 设计文档：pi-adapter-layer-reorg

## 设计目标

消除 `src/adapter/pi/` 全部跨层依赖（含 type-only），恢复 adapter → application → data 依赖方向；通过"实现归位"根治 repositories/services 命名冲突。

## 核心洞察

跨层依赖分为两类，处理方向相反：

| 类 | 情况 | 根因 | 处理 |
|----|------|------|------|
| **实现类放错层** | SubSkillRepository（数据访问实现）在 adapter | 实现接口必然 import 接口 → 跨层 | **实现下沉** data 层 |
| **接口放错层** | ISubProcessRunner 接口在 data，唯一实现（SubProcessRunner）是 pi 平台代码必须留 adapter | 接口在下层、实现在上层，实现引用接口即跨层 | **接口上移** application 层 |

判定准则：**实现类能否下沉，取决于它是否依赖平台 API**。
- SubSkillRepository：纯文件系统扫描，无 pi 平台依赖 → 下沉 data ✅
- SubProcessRunner / RpcProcessPool：spawn pi 进程，平台强绑定 → 留 adapter，接口上移 ✅

## 模块清单

### 移动/新增文件

| 文件 | 层级 | 职责 | 依赖 |
|------|------|------|------|
| `data/services/agent/SubSkillRepository.ts`（移入） | data | IAgentRepository 实现，sub-skill 发现 | data/entities、node fs |
| `application/services/ScopePolicy.ts`（移入） | application | IAccessPolicyService 实现，纯委托 | data/services/scope/policy |
| `application/services/ISubProcessRunner.ts`（移入） | application | 子进程运行器接口（原 data/repositories） | data/entities（类型） |
| `application/services/agentRepository.ts`（新增） | application | agent 仓库端口 + 实体类型的统一透出口 | data/repositories、data/entities（仅 re-export） |

### 修改文件

| 文件 | 改动 |
|------|------|
| `application/CoreDIContainer.ts` | 新增 `agentRepo` 字段，组装 SubSkillRepository（application → data 合法） |
| `application/services/IAccessPolicyService.ts` | 追加 `export { SCOPE_SKIP_ENV }`（访问策略域出口，同域 re-export） |
| `application/useCases/SpawnAgentUseCase.ts` | ISubProcessRunner import 改 application 路径 |
| `adapter/pi/DIContainer.ts` | agentRepo 改经 CoreDIContainer 获取；ScopePolicy import 改 application |
| `adapter/pi/index.ts` | 移除 SubSkillRepository 导出（无外部消费者） |
| `adapter/pi/tools/ListAgentsTool.ts` | AgentDefinition 改从 application 透出 |
| `adapter/pi/tools/SpawnAgentTool.ts` | AgentRunResult 改从 application 透出 |
| `adapter/pi/runtime/RpcProcessPool.ts` | IAgentRepository / AgentRunResult / AgentUsage / SCOPE_SKIP_ENV 四处 import 改 application |
| `adapter/pi/runtime/SubProcessRunner.ts` | ISubProcessRunner / AgentRunResult / AgentUsage / SCOPE_SKIP_ENV 改 application |
| `adapter/pi/tools/ToolAccessGuard.integration.test.ts` | ScopePolicy import 改 application |
| `adapter/pi/README.md` | 目录树 + 依赖图更新（同时修正 IAccessPolicy/IAccessPolicyService 过时描述） |
| `data/repositories/index.ts` | 移除 ISubProcessRunner 导出 |

### 删除文件

- `adapter/pi/repositories/SubSkillRepository.ts` + 空目录 `repositories/`
- `adapter/pi/services/ScopePolicy.ts` + 空目录 `services/`

## 类型透出规则（本次设计核心决策）

adapter 层不直接 import data，所需类型一律经 application 层出口：

| adapter 需要 | 透出位置 | 说明 |
|-------------|---------|------|
| `IAgentRepository`、`AgentDefinition`、`AgentDiscoveryResult`、`AgentScope` | `application/services/agentRepository.ts`（新） | 独立透出文件，职责单一 |
| `AgentRunResult`、`AgentUsage` | `application/services/ISubProcessRunner.ts`（上移后 re-export） | 接口签名已含，同域透出 |
| `SCOPE_SKIP_ENV` | `application/services/IAccessPolicyService.ts`（追加 re-export） | 与 policy.ts 同域（该文件 @intent 已声明同域） |

注意：`DiscoverAgentsOutput`（= AgentDiscoveryResult）已存在，保留；透出文件与之互补而非替代。

## 依赖链（设计后）

```
extension.ts (adapter/pi)
  → DIContainer (adapter/pi)
    ├→ CoreDIContainer (application) → SubSkillRepository (data/services/agent)   ← data 实现组装在 application，合法
    ├→ DiscoverAgentsUseCase / SpawnAgentUseCase (application/useCases)
    │    ├→ IAgentRepository (data/repositories)            ← application → data，合法
    │    └→ ISubProcessRunner (application/services)        ← 同层
    ├→ SubProcessRunner / RpcProcessPool (adapter/pi/runtime)
    │    → ISubProcessRunner / agentRepository 透出 / IAccessPolicyService 透出 (application)   ← adapter → application，合法
    ├→ ScopePolicy (application/services) → data/services/scope/policy   ← application → data，合法
    └→ ToolAccessGuard → IAccessPolicyService (application/services)     ← adapter → application，合法
```

全链无 adapter → data 引用。

## 本次设计决策

### 决策 1：SubSkillRepository 落位 `data/services/agent/`
- **理由**：data 层实现类惯例在 `data/services/<域>/`（CacheRepositoryImpl、CodeParserRepositoryImpl、FileSystemRepository 均如此），接口才在 `data/repositories/`；新建 `agent/` 域目录与 cache/scope 等并列
- **类名保留** `SubSkillRepository`，不做重命名（避免无谓 churn）

### 决策 2：ISubProcessRunner 上移 application/services/（与 IAccessPolicyService 并列）
- **理由**：唯一实现 SubProcessRunner 是 pi 平台适配（spawn pi 进程），不可下沉；接口留 data 则实现必然跨层引用。上移后实现与用例（SpawnAgentUseCase）都只依赖 application
- **对照**：IAgentRepository 因实现下沉 data，接口留在 data——两接口去向相反，均由实现位置决定

### 决策 3：SubSkillRepository 组装入 CoreDIContainer（application）
- **理由**：DIContainer（adapter）若直接 new SubSkillRepository（data）即跨层；CoreDIContainer 是"data 实现统一组装点"的既有归属（已组装 FileSystemRepository 等 3 个实现），加一个字段是结构顺延
- **trade-off**：CoreDIContainer 定位从"纯核心共享"扩展为"data 实现组装点"；若 agent 发现未来被其他 adapter 使用则天然共享
- **RpcProcessPool 构造参数不变**（仍收 IAgentRepository），仅类型来源改经透出

### 决策 4：类型透出用"独立文件 + 同域 re-export"组合
- 独立文件（agentRepository.ts）避免 useCase 文件职责混合；同域 re-export（ISubProcessRunner、IAccessPolicyService）让类型跟随所属域
- **约束**：透出仅 re-export，不透出实现类；adapter 禁止 import `data/services/agent/SubSkillRepository`

### 决策 5：SCOPE_SKIP_ENV 走 IAccessPolicyService 同域 re-export
- data/services/scope/policy.ts 保持纯函数零依赖不动；application 只做再导出，无逻辑搬移
- 子进程 env 注入逻辑（runtime 内 `childEnv[SCOPE_SKIP_ENV] = ...`）原地不动，仅 import 路径变化

## 预设测试

### 前置条件
- `npm run compile:pi` 可编译

### 验证步骤

1. **跨层清零**：`grep -rn "from '.*data/" src/adapter/` → 无输出
2. **编译**：`npm run compile:pi` → 通过（含移动文件后的悬空引用检查）
3. **测试回归**：`npx vitest run src/adapter/pi/ src/application/useCases/` → 全绿
4. **目录检查**：`adapter/pi/` 下无 repositories/ services/；`data/services/agent/` 存在
5. **功能回归**：pi 加载扩展 → list_agents 正常 → spawn_agent 正常 → PI_EXT_SKIP 拦截放行正常

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| 移动文件漏改引用导致编译失败 | 编译报错逐一修；DIContainer/index.ts 优先检查 |
| CoreDIContainer 引入 pi 域耦合 | 仅持有 data 实现（SubSkillRepository 无平台依赖），不引入 adapter 内容 |
| RpcProcessPool 类型透出后行为漂移 | 纯类型路径替换，无逻辑改动；测试回归覆盖 |
