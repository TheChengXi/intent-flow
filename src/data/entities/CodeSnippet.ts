// @intent: 代码片段实体，表示一段代码的基本信息

// @entity: CodeSnippet
// 代码片段
export interface CodeSnippet {
  filePath: string;      // 文件路径
  startLine: number;     // 起始行号（从 0 开始）
  endLine: number;       // 结束行号
  code: string;          // 代码内容
  language: string;      // 编程语言
}
