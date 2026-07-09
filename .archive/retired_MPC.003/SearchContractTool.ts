import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { SearchContractUseCase, SearchContractInput } from '../../../application/useCases/SearchContractUseCase';

// @intent: 搜索契约 MCP Tool

export class SearchContractTool implements MCPToolHandler<SearchContractInput, string | null> {
  definition: MCPToolDefinition = {
    name: 'search_contract',
    description: '搜索函数的 @contract 注释',
    inputSchema: {
      type: 'object',
      properties: {
        functionName: {
          type: 'string',
          description: '函数名'
        },
        workspaceRoot: {
          type: 'string',
          description: '工作区根目录'
        }
      },
      required: ['functionName', 'workspaceRoot']
    }
  };

  constructor(private useCase: SearchContractUseCase) {}

  async execute(input: SearchContractInput): Promise<string | null> {
    return await this.useCase.execute(input);
  }
}
