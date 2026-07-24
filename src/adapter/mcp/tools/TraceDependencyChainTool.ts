/**
 * @intent
 * 作为 MCP 工具层，处理 TraceDependencyChainInput → TraceDependencyChainOutput。
 * 核心行为：接收 entryFile 参数，调用 TraceDependencyChainUseCase，返回同层/跨层依赖分组。
 * 输入：entryFile（必填）、projectRoot（可选）、layerConfig（可选）。
 * 输出：entry 信息 + dependencies（same_layer / cross_layer 两组）。
 * 谁调用：MCP Server 根据 "trace_dependency_chain" 工具名分发至此。
 * 边界：entryFile 不存在时向上抛错；依赖读取失败跳过单条。
 */

import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { TraceDependencyChainInput, TraceDependencyChainOutput, ITraceDependencyChainUseCase } from '../../../application/useCases/TraceDependencyChainUseCase';

export class TraceDependencyChainTool implements MCPToolHandler<TraceDependencyChainInput, TraceDependencyChainOutput> {
  definition: MCPToolDefinition = {
    name: 'trace_dependency_chain',
    description: '沿入口文件的依赖链追踪，分析直接依赖关系及 @intent 语义。给定一个入口文件，返回其直接依赖文件列表（1层深度），每个依赖带 @intent 描述。依赖按同层/跨层分组。',
    inputSchema: {
      type: 'object',
      properties: {
        entryFile: {
          type: 'string',
          description: '入口文件路径（支持绝对路径，或相对于项目根目录的相对路径，如 "src/adapter/mcp/MCPServer.ts"）。必填。'
        },
        projectRoot: {
          type: 'string',
          description: '项目根目录（绝对路径，可选）。默认使用当前工作目录。'
        },
        layerConfig: {
          type: 'object',
          description: '架构层级检测配置（可选，默认 CDD 三层：data/application/adapter）。用于非 CDD 项目的同层/跨层分组。',
          properties: {
            rules: {
              type: 'array',
              description: '层规则列表，按优先级顺序匹配。首条匹配即止。',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string', description: '层级名称（标识用）' },
                  pattern: { type: 'string', description: '正则字符串，应包含一个捕获组匹配层级目录名。如 "/(cmd)(/|$)"' },
                  subModule: { type: 'boolean', description: '是否提取该层后第一个子目录作为子模块名' }
                },
                required: ['name', 'pattern']
              }
            }
          },
          required: ['rules']
        }
      },
      required: ['entryFile']
    }
  };

  constructor(private useCase: ITraceDependencyChainUseCase) {}

  async execute(input: TraceDependencyChainInput): Promise<TraceDependencyChainOutput> {
    try {
      return await this.useCase.execute(input);
    } catch (error) {
      throw new Error(`分析依赖失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
