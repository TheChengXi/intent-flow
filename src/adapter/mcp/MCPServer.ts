import { McpServer } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { DIContainer } from './DIContainer';

/**
 * @intent
 * MCP 协议适配入口（SDK v2）：基于 @modelcontextprotocol/server 的 McpServer + serveStdio 提供服务，经 registerTool 注册 DIContainer 中的全部工具。
 * 边界：工具执行失败返回 isError 响应不中断服务；stdout 仅承载 JSON-RPC 帧（业务日志禁止写 stdout）。
 * 验收条件：
 * - 无 @modelcontextprotocol/sdk 旧 API 引用（tsc 无弃用警告）
 * - 全部工具经 registerTool 注册（name/description/inputSchema 取自 tool.definition）
 */

export class MCPServer {
  private container: DIContainer;

  constructor() {
    this.container = DIContainer.getInstance();
  }

  // @contract: registerTools(server) => void
  // @step: [遍历工具] 从容器获取全部 MCPToolHandler
  // @step: [注册] 每个工具经 registerTool(name, {description, inputSchema}, cb) 注册
  // @step: [错误响应] 工具执行抛错时返回 isError 响应（含错误信息与入参），不中断服务
  private registerTools(server: McpServer): void {
    const tools = this.container.getAllTools();

    for (const tool of tools) {
      const { name, description, inputSchema } = tool.definition;

      server.registerTool(
        name,
        { description, inputSchema },
        async (args) => {
          try {
            const result = await tool.execute(args as any);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);

            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(
                    {
                      error: errorMessage,
                      tool: name,
                      arguments: args,
                    },
                    null,
                    2
                  ),
                },
              ],
              isError: true,
            };
          }
        }
      );
    }
  }

  // @contract: createServer() => McpServer
  // @step: [创建] 构造 McpServer（工具能力）
  // @step: [注册] 注册容器中全部工具
  // @boundary: 每连接一个实例（serveStdio 工厂调用）；DIContainer 单例共享
  createServer(): McpServer {
    const server = new McpServer(
      {
        name: 'intent-flow',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.registerTools(server);
    return server;
  }
}

function main() {
  const server = new MCPServer();

  // @note: serveStdio 托管传输生命周期（era 决策 + 连接管理），每连接经工厂创建 McpServer 实例
  serveStdio(() => server.createServer());

  console.error('IntentFlow MCP Server started (SDK v2)');
}

main();
