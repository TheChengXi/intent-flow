import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { ProjectIntentUseCase, ProjectIntentInput, ProjectIntentResult } from '../../../application/useCases/ProjectIntentUseCase';

/**
 * @intent
 * 封装 ProjectIntentUseCase 为 MCP 工具，对外暴露 project_intent。自动创建父目录并根据后缀选择注释语法。
 * force=true 时在已有文件中替换/插入 @intent，不覆盖其他内容
 */

export class ProjectIntentTool implements MCPToolHandler<ProjectIntentInput, ProjectIntentResult> {
  definition: MCPToolDefinition = {
    name: 'project_intent',
    description: '创建/更新 @intent 注释。文件不存在时自动创建；已存在时替换/插入 @intent，保留其他内容。',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: '目标文件路径（绝对或相对路径）'
        },
        intent: {
          type: 'string',
          description: '@intent 正文内容（纯文本，工具自动添加 @intent 前缀和注释符号）'
        },
        force: {
          type: 'boolean',
          description: '文件已存在时是否替换/插入 @intent（默认 false，跳过不修改）'
        }
      },
      required: ['path', 'intent']
    }
  };

  constructor(private useCase: ProjectIntentUseCase) {}

  async execute(input: ProjectIntentInput): Promise<ProjectIntentResult> {
    return await this.useCase.execute(input);
  }
}
