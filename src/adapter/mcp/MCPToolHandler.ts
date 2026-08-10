/**
 * @intent
 * Tool 基类接口：MCPToolDefinition 定义工具名/描述/输入 schema，inputSchema 采用 zod v4 schema（v2 registerTool 原生支持），执行经 execute(input)。
 * 验收条件：
 * - inputSchema 类型为 zod（ZodRawShape），非手写 JSON Schema
 * - 接口不含 @modelcontextprotocol/sdk 依赖
 */

import type { ZodRawShape, ZodObject } from 'zod';

export interface MCPToolDefinition {
  name: string;
  description: string;
  /** zod v4 object schema：v2 registerTool 主重载原生支持（非弃用的 ZodRawShape 形式） */
  inputSchema: ZodObject<ZodRawShape>;
}

export interface MCPToolHandler<TInput = unknown, TOutput = unknown> {
  definition: MCPToolDefinition;
  execute(input: TInput): Promise<TOutput>;
}
