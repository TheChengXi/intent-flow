# ProjectIntentTool.ts

`src/adapter/mcp/tools/ProjectIntentTool.ts`

**intent:** 封装 ProjectIntentUseCase 为 MCP 工具，对外暴露 project_intent。自动创建父目录并根据后缀选择注释语法。 force=true 时在已有文件中替换/插入 @intent，不覆盖其他内容
