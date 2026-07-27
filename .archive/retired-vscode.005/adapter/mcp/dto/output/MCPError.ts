/**
 * @intent
 * MCP 工具的统一错误响应格式。
 * 当工具执行失败时，返回该格式的错误信息。
 */

export interface MCPError {
  /**
   * 错误信息（用户友好的描述）
   */
  error: string;

  /**
   * 错误代码（可选，用于编程错误处理）
   * 如：'DIRECTORY_NOT_FOUND', 'INVALID_INPUT', 'PARSE_ERROR'
   */
  code?: string;

  /**
   * 额外的错误详情（可选）
   * 如：{ path: "...", reason: "..." }
   */
  details?: Record<string, any>;

  /**
   * 错误发生的时间戳（毫秒）
   */
  timestamp: number;
}
