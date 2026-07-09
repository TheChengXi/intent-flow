/**
 * @intent
 * 作为 MCP 工具层，处理 ListLayerCapabilitiesInput → ListLayerCapabilitiesOutput。
 * 核心行为：接收 layer 参数，调用 ScanIntentsUseCase 全量扫描 @intent → 按路径层级过滤。
 * 输入：layer（必填）、projectRoot（可选）、directoryPath（可选，默认 projectRoot/src）。
 * 输出：capabilities[]（CapabilitySummary 列表）+ totalCapabilities。
 * 谁调用：MCP Server 根据 "list_layer_capabilities" 工具名分发至此。
 * 边界：指定层级不存在时返回空列表；非 ts/js 文件不会被扫描。
 */

import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { IScanIntentsUseCase, ScanIntentsInput } from '../../../application/useCases/ScanIntentsUseCase';
import { ListLayerCapabilitiesInput } from '../dto/input/ListLayerCapabilitiesInput';
import { ListLayerCapabilitiesOutput, CapabilitySummary } from '../dto/output/ListLayerCapabilitiesOutput';

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

export class ListLayerCapabilitiesTool implements MCPToolHandler<ListLayerCapabilitiesInput, ListLayerCapabilitiesOutput> {
  definition: MCPToolDefinition = {
    name: 'list_layer_capabilities',
    description: '列出指定架构层的所有 @intent 能力。支持按层级（Data/Application/Adapter）筛选，返回该层级的文件列表及 @intent 语义。',
    inputSchema: {
      type: 'object',
      properties: {
        layer: {
          type: 'string',
          description: '架构层名称，如 "Data"、"Application"、"Adapter"。必填。'
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
      required: ['layer']
    }
  };

  constructor(private scanIntentsUseCase: IScanIntentsUseCase) {}

  async execute(input: ListLayerCapabilitiesInput): Promise<ListLayerCapabilitiesOutput> {
    try {
      const projectRoot = input.projectRoot || process.cwd();
      const directoryPath = input.directoryPath || `${projectRoot}/src`;
      const targetLayer = input.layer.toLowerCase();

      const scanInput: ScanIntentsInput = {
        directoryPath,
        recursive: true,
        extensions: ['.ts', '.tsx', '.js', '.jsx']
      };

      const scanOutput = await this.scanIntentsUseCase.execute(scanInput);

      // 按层级过滤：匹配 targetLayer（大小写不敏感）
      const filtered = scanOutput.intents.filter((intent) => {
        const intentLayer = extractLayer(intent.filePath).toLowerCase();
        return intentLayer === targetLayer || intentLayer.startsWith(targetLayer + '/');
      });

      const capabilities: CapabilitySummary[] = filtered.map((intent) => ({
        file: intent.fileName,
        filePath: intent.filePath,
        intent: intent.intent,
        layer: extractLayer(intent.filePath),
      }));

      return {
        capabilities,
        totalCapabilities: capabilities.length
      };
    } catch (error) {
      throw new Error(`列出层级能力失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
