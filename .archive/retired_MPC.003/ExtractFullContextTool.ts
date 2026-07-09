import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { ExtractFullContextUseCase, ExtractFullContextInput } from '../../../application/useCases/ExtractFullContextUseCase';
import { DependencyBranch } from '../../../data/entities/DependencyBranch';
import { HookManager } from '../../../application/hooks/HookManager';

// @intent: 全文上下文提取 MCP Tool

export class ExtractFullContextTool implements MCPToolHandler<ExtractFullContextInput, DependencyBranch> {
  definition: MCPToolDefinition = {
    name: 'extract_full_context',
    description: '提取文件及其所有依赖的完整内容（文件级别）',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '文件路径'
        },
        workspaceRoot: {
          type: 'string',
          description: '工作区根目录'
        },
        depth: {
          type: 'number',
          description: '依赖深度，默认 2'
        }
      },
      required: ['filePath', 'workspaceRoot']
    }
  };

  constructor(
    private useCase: ExtractFullContextUseCase,
    private hookManager: HookManager
  ) {}

  async execute(input: ExtractFullContextInput): Promise<DependencyBranch> {
    const startTime = Date.now();

    try {
      await this.hookManager.trigger('before_extract', {
        filePath: input.filePath,
        depth: input.depth || 2
      });

      const result = await this.useCase.execute(input);

      const duration = Date.now() - startTime;
      await this.hookManager.trigger('after_extract', {
        result,
        duration,
        filePath: input.filePath
      });

      return result;
    } catch (error) {
      await this.hookManager.trigger('on_error', {
        error: error as Error,
        operation: 'extract_full_context',
        input
      });

      throw error;
    }
  }
}
