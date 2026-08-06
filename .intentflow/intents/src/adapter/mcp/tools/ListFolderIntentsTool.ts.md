# ListFolderIntentsTool.ts

`src/adapter/mcp/tools/ListFolderIntentsTool.ts`

**intent:** MCP 工具：扫描文件夹（非递归），提取每个文件的 @intent，返回结构化意图清单（含子文件夹名）。 实现 MCPToolHandler 接口，调用 ListFolderIntentsUseCase.execute()。 输入：{ folder: string }；输出：ListFolderIntentsResult。
