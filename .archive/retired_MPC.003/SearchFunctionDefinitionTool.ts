import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { SearchFunctionDefinitionUseCase, SearchFunctionDefinitionInput } from '../../../application/useCases/SearchFunctionDefinitionUseCase';
import { FunctionDefinition } from '../../../data/entities/FunctionDefinition';
import { HookManager } from '../../../application/hooks/HookManager';

// @intent: 搜索函数定义 MCP Tool

export class SearchFunctionDefinitionTool implements MCPToolHandler<SearchFunctionDefinitionInput, FunctionDefinition | null> {
  definition: MCPToolDefinition = {
    name: 'search_function_definition',
    description: '在文件中搜索函数定义，返回完整代码（包含注释）',
    inputSchema: {
      type: 'object',
      properties: {
        functionName: {
          type: 'string',
          description: '函数名'
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
      required: ['functionName', 'filePath']
    }
  };

  constructor(
    private useCase: SearchFunctionDefinitionUseCase,
    private hookManager: HookManager
  ) {}

  async execute(input: SearchFunctionDefinitionInput): Promise<FunctionDefinition | null> {
    const startTime = Date.now();

    try {
      await this.hookManager.trigger('before_search', {
        name: input.functionName,
        filePath: input.filePath,
        language: input.language || 'typescript',
        type: 'function'
      });

      const result = await this.useCase.execute(input);

      const duration = Date.now() - startTime;
      await this.hookManager.trigger('after_search', {
        name: input.functionName,
        filePath: input.filePath,
        result,
        duration,
        found: result !== null,
        type: 'function'
      });

      return result;
    } catch (error) {
      await this.hookManager.trigger('on_error', {
        error: error as Error,
        operation: 'search_function_definition',
        input
      });

      throw error;
    }
  }
}
