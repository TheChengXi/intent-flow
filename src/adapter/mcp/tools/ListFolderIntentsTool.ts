/**
 * @intent
 * MCP 工具：扫描文件夹（非递归），提取每个文件的 @intent，返回结构化意图清单（含子文件夹名）。实现 MCPToolHandler 接口，调用 ListFolderIntentsUseCase.execute()。
 * 输入：{ folder: string }；输出：ListFolderIntentsResult。
 * 验收条件：
 * - inputSchema 为 zod schema：folder(必填 string)
 * - 执行委托 UseCase 不变
 */


import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { ListFolderIntentsUseCase, ListFolderIntentsResult } from '../../../application/useCases/ListFolderIntentsUseCase';
import { z } from 'zod';

export interface ListFolderIntentsInput {
  folder: string;
}

export class ListFolderIntentsTool implements MCPToolHandler<ListFolderIntentsInput, ListFolderIntentsResult> {
  definition: MCPToolDefinition = {
    name: 'list_folder_intents',
    description: '扫描指定文件夹（非递归），列出每个文件的 @intent 意图清单，含子文件夹名。',
    inputSchema: z.object({
      folder: z.string().describe('目标文件夹路径')
    })
  };

  constructor(private useCase: ListFolderIntentsUseCase) {}

  /**
   * @contract
   * 执行文件夹意图扫描。
   * 输入：{ folder: string } - 目标文件夹路径
   * 输出：ListFolderIntentsResult - 结构化意图清单
   * 错误：folder 为空时由 UseCase 定义
   */
  async execute(input: ListFolderIntentsInput): Promise<ListFolderIntentsResult> {
    // @step: 委托给 UseCase
    return this.useCase.execute(input.folder);
  }
}
