import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { CheckFileSizeUseCase } from '../../../application/useCases/CheckFileSizeUseCase';
import { FileSizeCheckResult, FileSizeCheckInput } from '../../../data/entities/FileSizeCheckResult';

/**
 * @intent
 * 封装 CheckFileSizeUseCase 为 MCP 工具，对外暴露 check_file_size。
 * 边界：阈值默认 400 行；目录路径时递归扫描
 */

export class CheckFileSizeTool implements MCPToolHandler<FileSizeCheckInput, FileSizeCheckResult[]> {
  definition: MCPToolDefinition = {
    name: 'check_file_size',
    description: '检查文件及其依赖树的大小，识别需要重构的文件',
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
        threshold: {
          type: 'number',
          description: '阈值（行数），默认 400'
        }
      },
      required: ['filePath', 'workspaceRoot']
    }
  };

  constructor(private useCase: CheckFileSizeUseCase) {}

  async execute(input: FileSizeCheckInput): Promise<FileSizeCheckResult[]> {
    return await this.useCase.execute(input);
  }
}
