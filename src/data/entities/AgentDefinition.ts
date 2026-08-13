/**
 * @intent
 * pi agent 定义实体。表示一个从 SUB-SKILL.md 或 agents/*.md 发现的 agent，含 frontmatter 字段（name/description/tools/model）、合并后的 systemPrompt、来源追踪（source/skillName/filePath）与目录层级（origin）。
 * 
 * 边界：origin 为可选字段——sub-skill 扫描时标记 'global'（全局 ~/.pi/agent/skills）或 'project'（项目级 .pi/skills），user agents 扫描无层级概念不设置（undefined 视为全局优先级）；source 与 origin 正交（source=发现方式，origin=目录层级）。
 * 
 * 验收条件：
 * - AgentOrigin 类型与 origin 可选字段已定义，现有构造处（不传 origin）编译通过
 * - source 的 'project_agent' 枚举值保持不动（本次不复用）
 */


export type AgentSource = 'sub_skill' | 'user_agent' | 'project_agent';

/** Agent 发现作用域 */
export type AgentScope = 'sub_skill' | 'user' | 'both';

/** 目录层级来源（sub-skill 扫描时标记；user agents 无层级概念不设置） */
export type AgentOrigin = 'global' | 'project';

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
  /** 目录层级来源（sub-skill 扫描时有效；undefined 视为全局优先级） */
  origin?: AgentOrigin;
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
