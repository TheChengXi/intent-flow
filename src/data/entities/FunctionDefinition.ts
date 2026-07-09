// @intent: 函数定义实体，表示函数的完整定义信息

// @entity: FunctionDefinition
// 函数定义
export interface FunctionDefinition {
  functionName: string;  // 函数名
  code: string;          // 完整代码（包含注释）
  startLine: number;     // 起始行号
  endLine: number;       // 结束行号
  contract?: string;     // @contract 注释（如果有）
  filePath: string;      // 文件路径
}
