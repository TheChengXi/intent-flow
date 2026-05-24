// @entity: WorkLine
// 工作行（一个函数的注释+代码范围）
export interface WorkLine {
  functionName: string;
  startLine: number;
  endLine: number;
  commentStartLine: number;
  commentEndLine: number;
  codeStartLine: number;
  codeEndLine: number;
  commentText: string;
  codeText: string;
}
