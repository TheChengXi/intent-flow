/**
 * @intent
 * 文件大小检查的输入/输出实体定义。FileSizeCheckInput 只含 filePath（绝对路径）和可选的 threshold（默认 400），已移除 workspaceRoot。FileSizeCheckResult 已移除 lineCount，needsRefactor 仅在超标时出现（可选字段）。
 */

// @entity: FileSizeCheckResult
// 文件大小检查结果
export interface FileSizeCheckResult {
  filePath: string;        // 文件路径（绝对路径）
  exceedLines: number;     // 超出阈值行数
  needsRefactor?: boolean; // 是否需要重构（仅超标时出现）
}

// @entity: FileSizeCheckInput
// 文件大小检查输入
export interface FileSizeCheckInput {
  filePath: string;       // 文件绝对路径
  threshold?: number;     // 阈值（行数），默认 400
}
