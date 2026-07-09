import { CDDComment } from '../../data/entities/CDDComment';

// @entity: WorkflowContext
// 工作流上下文
export interface WorkflowContext {
  document: any;  // vscode.TextDocument
  selection: any;  // vscode.Selection
  workspaceRoot: string;
  apiKey: string;
  apiBaseUrl?: string;
  modelId?: string;
  targetLanguage?: string;
}

// @entity: WorkflowResult
// 工作流执行结果
export interface WorkflowResult {
  success: boolean;
  message: string;
  finalCode?: string;
  reviewPassed?: boolean;
  retryCount?: number;
  executionPath: string[];  // 记录执行路径，如 ['compiler', 'reviewer', 'compiler', 'reviewer']
}

// @entity: WorkflowType
// 工作流类型
export type WorkflowType = 'compile' | 'review' | 'translate';
