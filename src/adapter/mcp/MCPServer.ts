import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { DIContainer } from './DIContainer';

/**
 * @intent
 * MCP 协议适配入口，将 MCP JSON-RPC 请求分发到对应 Tool。
 * 边界：启动时向 SDK 注册所有工具列表；每个请求通过 DIContainer 路由到具体 handler
 */

export class MCPServer {
  private server: Server;
  private container: DIContainer;

  constructor() {
    this.container = DIContainer.getInstance();

    this.server = new Server(
      {
        name: 'cdd-framework',
        version: '2.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = this.container.getAllTools();

      return {
        tools: tools.map(tool => ({
          name: tool.definition.name,
          description: tool.definition.description,
          inputSchema: tool.definition.inputSchema,
        })),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      const tools = this.container.getAllTools();
      const tool = tools.find(t => t.definition.name === name);

      if (!tool) {
        throw new Error(`Unknown tool: ${name}`);
      }

      try {
        const result = await tool.execute(args as any || {});

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
              text: JSON.stringify({
                error: errorMessage,
                tool: name,
                arguments: args,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);

    console.error('CDD Framework MCP Server started');
  }
}

async function main() {
  const server = new MCPServer();
  await server.start();
}

main().catch((error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});
