// @intent: 文件大小检查结果实体，表示文件大小检查的结果

// @entity: FileSizeCheckResult
// 文件大小检查结果
export interface FileSizeCheckResult {
  filePath: string;       // 文件路径
  lineCount: number;      // 行数
  exceedLines: number;    // 超出行数
  needsRefactor: boolean; // 是否需要重构
}

// @entity: FileSizeCheckInput
// 文件大小检查输入
export interface FileSizeCheckInput {
  filePath: string;       // 文件路径
  workspaceRoot: string;  // 工作区根目录
  threshold?: number;     // 阈值（行数），默认 400
}
