import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { GetCacheStatsUseCase } from '../../../application/useCases/GetCacheStatsUseCase';
import { CacheStats } from '../../../data/entities/CacheStats';

// @intent: 获取缓存统计 MCP Tool

export class GetCacheStatsTool implements MCPToolHandler<void, CacheStats> {
  definition: MCPToolDefinition = {
    name: 'get_cache_stats',
    description: '获取缓存使用统计信息',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  };

  constructor(private useCase: GetCacheStatsUseCase) {}

  async execute(): Promise<CacheStats> {
    return await this.useCase.execute();
  }
}
