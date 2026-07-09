/**
 * @intent
 * MCP 工具的输入参数定义。
 * 用于 search_capability_by_keyword 工具，指定搜索关键词和扫描路径。
 */

export interface SearchCapabilityByKeywordInput {
  /**
   * 搜索关键词（支持多个关键词，用空格分隔）
   * 如："User Management" 或 "用户 权限"
   */
  keyword: string;

  /**
   * 项目根目录（可选）
   */
  projectRoot?: string;

  /**
   * 扫描目录（可选）
   */
  directoryPath?: string;
}
