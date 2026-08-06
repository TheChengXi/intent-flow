# CheckFileSizeTool.ts

`src/adapter/mcp/tools/CheckFileSizeTool.ts`

**intent:** 封装 CheckFileSizeUseCase 为 MCP 工具，对外暴露 check_file_size。输入只含 filePath（必填，绝对路径）和可选 threshold（默认 400），已移除 workspaceRoot。
