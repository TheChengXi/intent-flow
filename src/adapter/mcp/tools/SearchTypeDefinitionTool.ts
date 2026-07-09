import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { SearchTypeDefinitionUseCase, SearchTypeDefinitionInput } from '../../../application/useCases/SearchTypeDefinitionUseCase';
import { HookManager } from '../../../application/hooks/HookManager';

/**
 * @intent
 * 封装 SearchTypeDefinitionUseCase 为 MCP 工具，对外暴露 search_type_definition。
 * 边界：文件不存在时 UseCase 抛错，Tool 层透传
 */

export class SearchTypeDefinitionTool implements MCPToolHandler<SearchTypeDefinitionInput, string | null> {
  definition: MCPToolDefinition = {
    name: 'search_type_definition',
    description: '在文件中搜索类型定义（interface、type、class、enum）',
    inputSchema: {
      type: 'object',
      properties: {
        typeName: {
          type: 'string',
          description: '类型名'
        },
        filePath: {
          type: 'string',
          description: '文件路径'
        },
        language: {
          type: 'string',
          description: '编程语言（可选）'
        }
      },
      required: ['typeName', 'filePath']
    }
  };

  constructor(
    private useCase: SearchTypeDefinitionUseCase,
    private hookManager: HookManager
  ) {}

  async execute(input: SearchTypeDefinitionInput): Promise<string | null> {
    const startTime = Date.now();

    try {
      await this.hookManager.trigger('before_search', {
        name: input.typeName,
        filePath: input.filePath,
        language: input.language || 'typescript',
        type: 'type'
      });

      const result = await this.useCase.execute(input);

      const duration = Date.now() - startTime;
      await this.hookManager.trigger('after_search', {
        name: input.typeName,
        filePath: input.filePath,
        result,
        duration,
        found: result !== null,
        type: 'type'
      });

      return result;
    } catch (error) {
      await this.hookManager.trigger('on_error', {
        error: error as Error,
        operation: 'search_type_definition',
        input
      });

      throw error;
    }
  }
}
