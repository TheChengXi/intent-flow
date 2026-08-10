/**
 * @intent
 * 作为 MCP 工具层，处理 TraceDependencyChainInput → TraceDependencyChainOutput。核心行为：接收 entryFile 参数，调用 TraceDependencyChainUseCase，返回同层/跨层依赖分组。
 * 输入：entryFile（必填）、layerConfig（可选）。输出：entry 信息 + dependencies（same_layer / cross_layer 两组）。
 * 验收条件：
 * - inputSchema 为 zod schema：entryFile(必填 string)、layerConfig(可选嵌套对象 rules 数组)
 * - entryFile 不存在时向上抛错（错误由 MCPServer 转 isError）
 */


import { MCPToolHandler, MCPToolDefinition } from '../MCPToolHandler';
import { TraceDependencyChainInput, TraceDependencyChainOutput, ITraceDependencyChainUseCase } from '../../../application/useCases/TraceDependencyChainUseCase';
import { z } from 'zod';

export class TraceDependencyChainTool implements MCPToolHandler<TraceDependencyChainInput, TraceDependencyChainOutput> {
  definition: MCPToolDefinition = {
    name: 'trace_dependency_chain',
    description: '沿入口文件的依赖链追踪，分析直接依赖关系及 @intent 语义。给定一个入口文件，返回其直接依赖文件列表（1层深度），每个依赖带 @intent 描述。依赖按同层/跨层分组。',
    inputSchema: z.object({
      entryFile: z.string().describe('入口文件路径（绝对路径）。必填。'),
      layerConfig: z
        .object({
          rules: z
            .array(
              z.object({
                name: z.string().describe('层级名称（标识用）'),
                pattern: z.string().describe('正则字符串，应包含一个捕获组匹配层级目录名。如 "/(cmd)(/|$)"'),
                subModule: z.boolean().optional().describe('是否提取该层后第一个子目录作为子模块名')
              })
            )
            .describe('层规则列表，按优先级顺序匹配。首条匹配即止。')
        })
        .optional()
        .describe('架构层级检测配置（可选，默认 IntentFlow 三层：data/application/adapter）。用于非 IntentFlow 项目的同层/跨层分组。')
    })
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
