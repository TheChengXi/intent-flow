/**
 * @intent
 * MCP 工具：列举所有可用的意图包名。
 * 实现 MCPToolHandler 接口，调用 IntentPackageQueryService.listPackages()。
 * 默认排除 deprecated 包，可通过 includeDeprecated 参数包含。
 */

import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { IntentPackageQueryService } from '../../../application/services/IntentPackageQueryService';

export interface ListIntentPackagesInput {
  includeDeprecated?: boolean;
}

export interface ListIntentPackagesOutput {
  packages: string[];
}

export class ListIntentPackagesTool implements MCPToolHandler<ListIntentPackagesInput, ListIntentPackagesOutput> {
  definition: MCPToolDefinition = {
    name: 'list_intent_packages',
    description: '列举所有可用的意图包名。默认排除已废弃的包。',
    inputSchema: {
      type: 'object',
      properties: {
        includeDeprecated: {
          type: 'boolean',
          description: '是否包含已废弃的包（默认 false）'
        }
      }
    }
  };

  private queryService: IntentPackageQueryService;

  constructor(queryService: IntentPackageQueryService) {
    this.queryService = queryService;
  }

  // @contract: execute(input) => ListIntentPackagesOutput
  // @step: [调用查询服务] 委托给 queryService.listPackages()
  async execute(input: ListIntentPackagesInput): Promise<ListIntentPackagesOutput> {
    const packages = await this.queryService.listPackages(input.includeDeprecated);
    return { packages };
  }
}
