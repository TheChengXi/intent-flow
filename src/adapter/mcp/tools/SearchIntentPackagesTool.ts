/**
 * @intent
 * MCP 工具：语义检索意图包。
 * 实现 MCPToolHandler 接口，调用 IntentPackageQueryService.searchPackages()。
 * 输入自然语言查询，LLM 粗筛+精排后返回匹配的包/组。
 */

import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { IntentPackageQueryService, SearchResult } from '../../../application/services/IntentPackageQueryService';

export interface SearchIntentPackagesInput {
  query: string;
}

export interface SearchIntentPackagesOutput {
  results: SearchResult[];
}

export class SearchIntentPackagesTool implements MCPToolHandler<SearchIntentPackagesInput, SearchIntentPackagesOutput> {
  definition: MCPToolDefinition = {
    name: 'search_intent_packages',
    description: '语义检索意图包。输入自然语言查询，返回匹配的包名、组名和关联理由。',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '自然语言查询，如 "注册后发邮件"'
        }
      },
      required: ['query']
    }
  };

  private queryService: IntentPackageQueryService;

  constructor(queryService: IntentPackageQueryService) {
    this.queryService = queryService;
  }

  // @contract: execute(input) => SearchIntentPackagesOutput
  // @step: [调用查询服务] 委托给 queryService.searchPackages()
  async execute(input: SearchIntentPackagesInput): Promise<SearchIntentPackagesOutput> {
    const results = await this.queryService.searchPackages(input.query);
    return { results };
  }
}
