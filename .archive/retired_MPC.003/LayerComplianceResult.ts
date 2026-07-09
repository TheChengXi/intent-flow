// @intent: 分层规范检查结果实体，表示文件是否符合分层架构规范

// @entity: LayerComplianceResult
// 分层规范检查结果
export interface LayerComplianceResult {
  filePath: string;                    // 文件路径
  layer: 'data' | 'application' | 'adapter' | 'unknown';  // 所属层级
  currentLines: number;                // 当前行数
  maxLines: number;                    // 限制行数
  isCompliant: boolean;                // 是否符合规范
  exceedLines: number;                 // 超出行数
  warningMessage?: string;             // 警告消息
  suggestions: string[];               // 重构建议列表
  requiresUserConfirmation: boolean;   // 是否需要用户确认
}

// @entity: LayerComplianceCheckInput
// 分层规范检查输入
export interface LayerComplianceCheckInput {
  filePath?: string;                   // 文件路径（可选，不提供则检查整个项目）
  workspaceRoot: string;               // 工作区根目录
  layer?: 'data' | 'application' | 'adapter';  // 手动指定层级（可选）
}
