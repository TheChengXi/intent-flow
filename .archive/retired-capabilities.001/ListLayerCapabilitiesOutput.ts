/**
 * @intent
 * MCP 工具的输出参数定义。
 * 用于 list_layer_capabilities 工具，返回指定层级的能力列表。
 */

export interface CapabilitySummary {
  /** 文件名（不含路径） */
  file: string;
  /** 文件路径（相对于项目根目录） */
  filePath: string;
  /** @intent 内容 */
  intent: string;
  /** 架构层级（data / application / adapter / adapter/mcp 等） */
  layer: string;
}

export interface ListLayerCapabilitiesOutput {
  /**
   * 该层级的能力列表
   */
  capabilities: CapabilitySummary[];

  /**
   * 该层级的总能力数
   */
  totalCapabilities: number;
}
