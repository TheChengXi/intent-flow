/**
 * @intent
 * pi agent 定义实体。表示一个从 SUB-SKILL.md 或 agents/*.md 发现的 agent，
 * 含 frontmatter 字段（name/description/tools/model）、合并后的 systemPrompt、
 * 来源追踪（source/skillName/filePath）。
 * Phase 1 完整实现。
 */

export type AgentSource = 'sub_skill' | 'user_agent' | 'project_agent';

/** Agent 发现作用域 */
export type AgentScope = 'sub_skill' | 'user' | 'both';

// ==================== Agent 定义 ====================

export interface AgentDefinition {
  /** Agent 名称（对应 SUB-SKILL.md 的 frontmatter name） */
  name: string;
  /** 描述（来自 frontmatter description） */
  description: string;
  /** 允许的工具白名单，无则使用所有默认工具 */
  tools?: string[];
  /** 模型覆盖，无则使用主线模型 */
  model?: string;
  /** 系统提示词（frontmatter body 合并） */
  systemPrompt: string;
  /** 来源类型 */
  source: AgentSource;
  /** 所属 skill 名（sub-skill 发现时有效） */
  skillName?: string;
  /** SUB-SKILL.md 或 .md 文件路径 */
  filePath: string;

}

// ==================== 发现结果 ====================

export interface AgentDiscoveryResult {
  /** 发现的 agent 列表 */
  agents: AgentDefinition[];
  /** 发现过程中的错误 */
  errors: string[];
}
