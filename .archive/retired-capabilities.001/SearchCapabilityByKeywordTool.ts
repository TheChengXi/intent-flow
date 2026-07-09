/**
 * @intent
 * 作为 MCP 工具层，处理 SearchCapabilityByKeywordInput → SearchCapabilityByKeywordOutput。
 * 核心行为：接收 keyword 参数，调用 ScanIntentsUseCase 全量扫描 @intent → 按关键词模糊匹配 → 按匹配度排序。
 * 输入：keyword（必填）、projectRoot（可选）、directoryPath（可选）。
 * 输出：matchedCapabilities[]（CapabilitySummary 列表）+ totalMatches + info（含 layersMatched、耗时）。
 * 谁调用：MCP Server 根据 "search_capability_by_keyword" 工具名分发至此。
 * 边界：关键词为空时报错；无匹配返回空列表；扫描失败抛错。
 */

import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { IScanIntentsUseCase, ScanIntentsInput } from '../../../application/useCases/ScanIntentsUseCase';
import { SearchCapabilityByKeywordInput } from '../dto/input/SearchCapabilityByKeywordInput';
import { CapabilitySummary } from '../dto/output/ListLayerCapabilitiesOutput';
import { SearchCapabilityByKeywordOutput } from '../dto/output/SearchCapabilityByKeywordOutput';

/** 从文件路径中提取架构层级 */
function extractLayer(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const match = normalized.match(/\/(data|application|adapter)(\/|$)/);
  if (!match) return 'unknown';
  const layer = match[1];
  if (layer === 'adapter') {
    const afterIndex = (match.index || 0) + match[0].length;
    const subDir = normalized.slice(afterIndex).split('/')[0];
    return subDir ? `${layer}/${subDir}` : layer;
  }
  return layer;
}

/** 计算文本与关键词的匹配度（命中关键词数） */
function matchScore(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter((kw) => lower.includes(kw)).length;
}

export class SearchCapabilityByKeywordTool implements MCPToolHandler<SearchCapabilityByKeywordInput, SearchCapabilityByKeywordOutput> {
  definition: MCPToolDefinition = {
    name: 'search_capability_by_keyword',
    description: '按关键词搜索相关 @intent 能力。支持中英文混合搜索，按匹配度排序。',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: '搜索关键词。支持多个关键词用空格分隔，如："User Management" 或 "用户 权限"。长度 1-100。必填。'
        },
        projectRoot: {
          type: 'string',
          description: '项目根目录（可选）。如果不提供，默认使用当前工作目录。'
        },
        directoryPath: {
          type: 'string',
          description: '扫描目录（可选）。默认为 projectRoot/src。'
        }
      },
      required: ['keyword']
    }
  };

  constructor(private scanIntentsUseCase: IScanIntentsUseCase) {}

  async execute(input: SearchCapabilityByKeywordInput): Promise<SearchCapabilityByKeywordOutput> {
    try {
      if (!input.keyword || input.keyword.trim().length === 0) {
        throw new Error('关键词不能为空');
      }

      const startTime = Date.now();
      const projectRoot = input.projectRoot || process.cwd();
      const directoryPath = input.directoryPath || `${projectRoot}/src`;

      const scanInput: ScanIntentsInput = {
        directoryPath,
        recursive: true,
        extensions: ['.ts', '.tsx', '.js', '.jsx']
      };

      const scanOutput = await this.scanIntentsUseCase.execute(scanInput);

      // 分词搜索（AND 逻辑）
      const keywords = input.keyword.toLowerCase().split(/\s+/).filter(k => k);

      const matched = scanOutput.intents
        .map((intent) => ({
          data: intent,
          score: matchScore(intent.fileName + ' ' + intent.intent, keywords)
        }))
        .filter((item) => item.score > 0)  // 至少命中一个关键词
        .sort((a, b) => b.score - a.score);  // 按匹配度排序

      const matchedCapabilities: CapabilitySummary[] = matched.map((item) => ({
        file: item.data.fileName,
        filePath: item.data.filePath,
        intent: item.data.intent,
        layer: extractLayer(item.data.filePath),
      }));

      // 提取匹配到的层级
      const layersMatched = Array.from(
        new Set(matchedCapabilities.map((c) => c.layer))
      );

      const searchDuration = Date.now() - startTime;

      return {
        matchedCapabilities,
        totalMatches: matchedCapabilities.length,
        keyword: input.keyword,
        info: {
          layersMatched,
          searchDuration
        }
      };
    } catch (error) {
      throw new Error(`搜索能力失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
