import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { CheckFileSizeUseCase, FileSizeCheckResult, FileSizeCheckInput } from '../../../application/useCases/CheckFileSizeUseCase';
import { z } from 'zod';

/**
 * @intent
 * 封装 CheckFileSizeUseCase 为 MCP 工具，对外暴露 check_file_size。输入只含 filePath（必填，绝对路径）和可选 threshold（默认 400）。
 * 类型经 CheckFileSizeUseCase re-export 获取，不直接 import data/entities。
 * 验收条件：
 * - inputSchema 为 zod schema：filePath(必填 string)、threshold(可选 number)
 * - 无 data/entities 直接 import
 */


export class CheckFileSizeTool implements MCPToolHandler<FileSizeCheckInput, FileSizeCheckResult[]> {
  definition: MCPToolDefinition = {
    name: 'check_file_size',
    description: '检查文件大小，判断是否超过阈值，需要重构',
    inputSchema: z.object({
      filePath: z.string().describe('文件绝对路径'),
      threshold: z.number().optional().describe('阈值（行数），默认 400')
    })
  };

  constructor(private useCase: CheckFileSizeUseCase) {}

  async execute(input: FileSizeCheckInput): Promise<FileSizeCheckResult[]> {
    return await this.useCase.execute(input);
  }
}
