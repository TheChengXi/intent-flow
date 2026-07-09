/**
 * @intent
 * MCP 工具的输出参数定义。
 * 用于 search_capability_by_keyword 工具，返回搜索结果和匹配信息。
 */

import { CapabilitySummary } from './ListLayerCapabilitiesOutput';

export interface SearchCapabilityByKeywordOutput {
  /**
   * 匹配的能力列表（按匹配度排序）
   */
  matchedCapabilities: CapabilitySummary[];

  /**
   * 匹配的总数
   */
  totalMatches: number;

  /**
   * 搜索的关键词
   */
  keyword: string;

  /**
   * 相关信息
   */
  info: {
    /**
     * 匹配到的层级列表
     */
    layersMatched: string[];

    /**
     * 搜索耗时（毫秒）
     */
    searchDuration: number;
  };
}
