# 需求文档：pi-adapter-layer-reorg

## 项目意图
消除 pi 适配层（src/adapter/pi）的全部跨层依赖，恢复 adapter → application → data 的严谨分层；通过实现类下沉根治 repositories/services 文件夹与 data 层的命名冲突。

## 功能清单
1. **SubSkillRepository 下沉 data 层**：数据访问实现类归位，不再停留 adapter 层
2. **ScopePolicy 下沉 application 层**：纯委托实现归位，与 IAccessPolicyService 同域
3. **tools/runtime 实体类型引用修正**：AgentDefinition / AgentRunResult / AgentUsage 等改为经 application 层输出类型透出
4. **SCOPE_SKIP_ENV 常量跨层引用修正**：runtime 对 data/services/scope/policy 常量引用的处理
5. **删除空文件夹**：adapter/pi/repositories、adapter/pi/services
6. **引用方同步修正**：DIContainer、index.ts、ToolAccessGuard.integration.test.ts、adapter/pi/README.md

## 核心功能

### 核心功能1：实现类下沉归位
- **能力**：系统能够将 IAgentRepository 实现（SubSkillRepository）归入 data 层、将 IAccessPolicyService 实现（ScopePolicy）归入 application 层，使 adapter 层不再承载接口实现
- **业务价值**：跨层依赖的根因（归属错误）被消除，而非修补 import；adapter 层只保留纯适配职责（工具、运行时、TUI、组装）

### 核心功能2：adapter 跨层引用清零
- **能力**：系统能够保证 src/adapter/ 下不存在任何对 src/data/ 的直接 import（含 type-only），实体类型统一经 application 层 UseCase 输出类型透出
- **业务价值**：分层可机械验证（grep 可查），后续新增代码有明确约束可依

### 核心功能3：命名冲突根治
- **能力**：系统能够移除 adapter/pi/repositories 与 adapter/pi/services 两个文件夹，消除与 data/repositories、data/services 的结构混淆
- **业务价值**：目录语义与分层语义一致——"repositories/services" 只存在于 data 层

## 业务规则

### 依赖方向规则
- **场景**：adapter/pi 下任何文件新增 import 时
- **行为**：只允许引用 application 层（及 pi 平台包、node 内置、同层文件），禁止引用 data 层任何模块
- **异常处理**：设计/审查阶段发现 adapter → data 引用即视为违规，必须改道 application 层

### 实现类归属规则
- **场景**：接口的默认/平台实现类需要落位时
- **行为**：数据访问实现归 data 层（README 约定 data = 实体 + 接口 + 实现）；应用逻辑纯委托实现归 application 层；只有真正依赖 pi 平台 API 的适配代码才留在 adapter
- **异常处理**：实现类若无法归位，说明接口抽象位置不当，应调整接口归属而非容忍跨层

### 实体类型透出规则
- **场景**：adapter 层代码需要 AgentDefinition / AgentRunResult 等 data 实体类型时
- **行为**：从 application 层 UseCase 的输出类型引用（如 DiscoverAgentsOutput），或经 application 层 re-export，禁止直接 import data/entities
- **异常处理**：application 层无对应输出类型时，在 application 层补充输出类型定义

### 常量透出规则（SCOPE_SKIP_ENV）
- **场景**：runtime（RpcProcessPool / SubProcessRunner）需要读取跳过策略的环境变量名时
- **行为**：经 application 层透出或迁移常量归属，禁止直接引用 data/services/scope/policy
- **异常处理**：透出方式在设计中定稿（re-export 或常量上移），需保证 data 层纯函数仍可独立使用

## 预设测试

> 从用户视角可执行的测试步骤，验证功能是否符合预期。

### 前置条件
- 项目可编译（npm run build / tsc）
- 现有测试套件可运行

### 测试步骤

1. **[跨层清零验证]**：执行 `grep -rn "from '.*data/" src/adapter/`
   **预期结果**：无任何输出（0 匹配）

2. **[编译验证]**：执行类型检查/构建
   **预期结果**：编译通过，无因移动文件产生的悬空引用错误

3. **[测试回归]**：运行现有测试（含 ToolAccessGuard.integration.test.ts）
   **预期结果**：全部通过

4. **[目录结构验证]**：查看 src/adapter/pi/ 目录
   **预期结果**：repositories/ 与 services/ 文件夹已删除，剩余 commands/runtime/tools/tui + 入口文件

5. **[功能回归]**：pi 插件加载，执行 list-agents、spawn-agent 各一次
   **预期结果**：行为与改动前一致（agent 列表正常、子进程调度正常、权限拦截按 PI_EXT_SKIP 生效）

### 异常场景

- **[移动后漏改引用]**：编译报 module not found → 按报错逐一修正 import 路径，DIContainer/index.ts 优先检查
- **[application 层无输出类型]**：tools 需要某实体类型但 UseCase 未透出 → 在 application 层补充输出类型，而非回退到直连 data
- **[常量迁移破坏 data 层独立使用]**：data/services/scope/policy.ts 应保持纯函数零依赖 → 迁移时以 re-export 保兼容，不做逻辑搬移

## 边界收束

**此时必做**：
- 6 项功能清单全部落地（下沉 ×2、类型透出、常量处理、删文件夹、引用方修正）
- @intent 同步更新（下沉文件的 location 描述、adapter 残留文件的意图修正）

**此时不做**：
- data/services/scope/IAccessPolicy.ts 疑似闲置接口的清理 — 与本次改动无直接依赖关系；若本次下沉后确认其彻底无引用，在设计阶段标记，清理放入后续 feature
- .archive/ 归档文档的更新 — 历史记录不追溯修改
- another_extension_pi / _source 等目录的适配 — 本次仅限 src/adapter/pi，若引用受影响（当前未发现）另行处理
