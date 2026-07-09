import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { ClearCacheUseCase } from '../../../application/useCases/ClearCacheUseCase';

// @intent: 清空缓存 MCP Tool

export class ClearCacheTool implements MCPToolHandler<void, void> {
  definition: MCPToolDefinition = {
    name: 'clear_cache',
    description: '清空所有缓存',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  };

  constructor(private useCase: ClearCacheUseCase) {}

  async execute(): Promise<void> {
    await this.useCase.execute();
  }
}
