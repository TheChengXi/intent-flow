import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { ExtractIntentUseCase, ExtractIntentInput } from '../../../application/useCases/ExtractIntentUseCase';
import { IntentResult } from '../../../data/entities/IntentResult';

// @intent: 提取意图 MCP Tool

export class ExtractIntentTool implements MCPToolHandler<ExtractIntentInput, IntentResult> {
  definition: MCPToolDefinition = {
    name: 'extract_intent',
    description: '提取文件的 @intent 注释',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '文件路径'
        }
      },
      required: ['filePath']
    }
  };

  constructor(private useCase: ExtractIntentUseCase) {}

  async execute(input: ExtractIntentInput): Promise<IntentResult> {
    return await this.useCase.execute(input);
  }
}
