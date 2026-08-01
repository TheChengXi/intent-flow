/**
 * @intent
 * data 层 agent 仓库端口与实体类型的 application 统一透出口。adapter 层组件（如 RpcProcessPool）需要 IAgentRepository 契约或 AgentDefinition 等实体类型时，一律经此引用，避免 adapter 直接跨层 import data。
 * 纯 re-export，不含任何逻辑与实例化。
 * 边界：不透出实现类（SubSkillRepository 不在此导出），不透出任何运行时值。
 * 验收条件：
 * - adapter 层引用 agent 域类型时全部经 application 路径，不出现 data/ 路径
 * - 所有导出为类型导出（type-only），无运行时副作用
 */

// ==================== 端口与实体类型透出 ====================
// adapter 层组件（RpcProcessPool 等）经此引用 agent 发现域契约与类型，
// 避免直接跨层 import data。纯类型导出，无运行时值。

export type { IAgentRepository } from '../../data/repositories/IAgentRepository';
export type { AgentDefinition, AgentDiscoveryResult, AgentScope } from '../../data/entities/AgentDefinition';
