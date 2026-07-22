import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { CheckFileSizeUseCase } from '../../../application/useCases/CheckFileSizeUseCase';
import { FileSizeCheckResult, FileSizeCheckInput } from '../../../data/entities/FileSizeCheckResult';

/**
 * @intent
 * 封装 CheckFileSizeUseCase 为 MCP 工具，对外暴露 check_file_size。输入只含 filePath（必填，绝对路径）和可选 threshold（默认 400），已移除 workspaceRoot。
 */

export class CheckFileSizeTool implements MCPToolHandler<FileSizeCheckInput, FileSizeCheckResult[]> {
  definition: MCPToolDefinition = {
    name: 'check_file_size',
    description: '检查文件大小，判断是否超过阈值，需要重构',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: '文件绝对路径'
        },
        threshold: {
          type: 'number',
          description: '阈值（行数），默认 400'
        }
      },
      required: ['filePath']
    }
  };

  constructor(private useCase: CheckFileSizeUseCase) {}

  async execute(input: FileSizeCheckInput): Promise<FileSizeCheckResult[]> {
    return await this.useCase.execute(input);
  }
}
