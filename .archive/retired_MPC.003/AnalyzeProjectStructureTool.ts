import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { AnalyzeProjectStructureUseCase, AnalyzeProjectStructureInput } from '../../../application/useCases/AnalyzeProjectStructureUseCase';
import { ProjectStructure } from '../../../data/entities/ProjectStructure';

// @intent: 分析项目结构 MCP Tool

export class AnalyzeProjectStructureTool implements MCPToolHandler<AnalyzeProjectStructureInput, ProjectStructure> {
  definition: MCPToolDefinition = {
    name: 'analyze_project_structure',
    description: '生成项目架构视图',
    inputSchema: {
      type: 'object',
      properties: {
        workspaceRoot: {
          type: 'string',
          description: '工作区根目录'
        },
        scope: {
          type: 'string',
          description: '范围过滤（模块名或文件名）'
        }
      },
      required: ['workspaceRoot']
    }
  };

  constructor(private useCase: AnalyzeProjectStructureUseCase) {}

  async execute(input: AnalyzeProjectStructureInput): Promise<ProjectStructure> {
    return await this.useCase.execute(input);
  }
}
