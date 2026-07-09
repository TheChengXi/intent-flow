import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { ExtractPartialContextUseCase, ExtractPartialContextInput } from '../../../application/useCases/ExtractPartialContextUseCase';
import { PartialContextResult } from '../../../data/entities/PartialContextResult';
import { HookManager } from '../../../application/hooks/HookManager';

// @intent: 部分上下文提取 MCP Tool

export class ExtractPartialContextTool implements MCPToolHandler<ExtractPartialContextInput, PartialContextResult> {
  definition: MCPToolDefinition = {
    name: 'extract_partial_context',
    description: '从选中代码范围提取函数及其直接依赖',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '文件路径'
        },
        startLine: {
          type: 'number',
          description: '起始行号（从 0 开始）'
        },
        endLine: {
          type: 'number',
          description: '结束行号'
        },
        workspaceRoot: {
          type: 'string',
          description: '工作区根目录'
        },
        depth: {
          type: 'number',
          description: '依赖深度，默认 1'
        }
      },
      required: ['filePath', 'startLine', 'endLine', 'workspaceRoot']
    }
  };

  constructor(
    private useCase: ExtractPartialContextUseCase,
    private hookManager: HookManager
  ) {}

  async execute(input: ExtractPartialContextInput): Promise<PartialContextResult> {
    const startTime = Date.now();

    try {
      await this.hookManager.trigger('before_extract', {
        filePath: input.filePath,
        startLine: input.startLine,
        endLine: input.endLine,
        depth: input.depth || 1
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
        operation: 'extract_partial_context',
        input
      });

      throw error;
    }
  }
}
