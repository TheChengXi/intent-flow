// @intent: MCP Tool 基类，定义 MCP Tool 的基本结构

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPToolHandler<TInput = unknown, TOutput = unknown> {
  definition: MCPToolDefinition;
  execute(input: TInput): Promise<TOutput>;
}
