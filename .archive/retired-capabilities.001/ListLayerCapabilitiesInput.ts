/**
 * @intent
 * MCP 工具的输入参数定义。
 * 用于 list_layer_capabilities 工具，指定要查询的层级及扫描路径。
 */

export interface ListLayerCapabilitiesInput {
  /**
   * 层级名称（如 "Data", "Application", "Adapter"）
   */
  layer: string;

  /**
   * 项目根目录（可选，默认当前工作目录）
   */
  projectRoot?: string;

  /**
   * 扫描目录（可选，默认 projectRoot/src）
   */
  directoryPath?: string;
}
