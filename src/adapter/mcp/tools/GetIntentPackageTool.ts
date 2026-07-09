/**
 * @intent
 * MCP 工具：获取单个意图包的公开视图。
 * 实现 MCPToolHandler 接口，调用 IntentPackageQueryService.getPackage()。
 * 输入：name - 包名
 * 输出：IntentPackagePublicView 或 not-found 错误
 */

import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { IntentPackageQueryService } from '../../../application/services/IntentPackageQueryService';
import { IntentPackagePublicView } from '../../../data/entities/IntentPackage';

export interface GetIntentPackageInput {
  name: string;
}

export class GetIntentPackageTool implements MCPToolHandler<GetIntentPackageInput, IntentPackagePublicView | { error: string }> {
  definition: MCPToolDefinition = {
    name: 'get_intent_package',
    description: '获取单个意图包的公开视图（含摘要、语义分组、文件映射、跨包引用）。包不存在或已废弃时返回错误。',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '包名，如 "auth"'
        }
      },
      required: ['name']
    }
  };

  private queryService: IntentPackageQueryService;

  constructor(queryService: IntentPackageQueryService) {
    this.queryService = queryService;
  }

  // @contract: execute(input) => Promise<IntentPackagePublicView | { error }>
  // @step: [调用查询服务] 委托给 queryService.getPackage()
  // @step: [返回结果] 如果查询结果非空，返回公开视图；否则返回错误
  async execute(input: GetIntentPackageInput): Promise<IntentPackagePublicView | { error: string }> {
    const view = await this.queryService.getPackage(input.name);
    if (!view) {
      return { error: `package not found: ${input.name}` };
    }
    return view;
  }
}
