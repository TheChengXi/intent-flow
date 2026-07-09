import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { CheckLayerComplianceUseCase } from '../../../application/useCases/CheckLayerComplianceUseCase';
import { LayerComplianceResult, LayerComplianceCheckInput } from '../../../data/entities/LayerComplianceResult';

// @intent: 检查分层规范 MCP Tool

export class CheckLayerComplianceTool implements MCPToolHandler<LayerComplianceCheckInput, LayerComplianceResult> {
  definition: MCPToolDefinition = {
    name: 'check_layer_compliance',
    description: '检查文件是否符合分层架构规范（行数限制）',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '文件路径（不提供则检查整个项目）'
        },
        workspaceRoot: {
          type: 'string',
          description: '工作区根目录'
        },
        layer: {
          type: 'string',
          description: '手动指定层级（data/application/adapter）',
          enum: ['data', 'application', 'adapter']
        }
      },
      required: ['workspaceRoot']
    }
  };

  constructor(private useCase: CheckLayerComplianceUseCase) {}

  async execute(input: LayerComplianceCheckInput): Promise<LayerComplianceResult> {
    return await this.useCase.execute(input);
  }
}
