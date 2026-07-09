// @entity: DryRunRecord
// 拦截记录的数据结构
export interface DryRunRecord {
  timestamp: Date;            // 拦截时间
  role: string;               // 角色类型（compiler/reviewer/translator 等）
  systemPrompt: string;       // 系统提示词
  userMessage: string;        // 用户消息
  statistics: {
    totalCharacters: number;  // 字符总数
    estimatedTokens: number;  // 预估 Token 数
    codeBlocks: number;       // 代码块数量
    fileReferences: number;   // 文件引用数量
  };
}

// @contract: createDryRunRecord(role: string, systemPrompt: string, userMessage: string, statistics: any) => DryRunRecord
// @step: [创建记录] 使用当前时间戳创建 DryRunRecord
// @boundary: timestamp 使用 new Date()
export function createDryRunRecord(
  role: string,
  systemPrompt: string,
  userMessage: string,
  statistics: {
    totalCharacters: number;
    estimatedTokens: number;
    codeBlocks: number;
    fileReferences: number;
  }
): DryRunRecord {
  return {
    timestamp: new Date(),
    role,
    systemPrompt,
    userMessage,
    statistics
  };
}
