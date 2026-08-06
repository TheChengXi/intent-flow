# FileSizeCheckResult.ts

`src/data/entities/FileSizeCheckResult.ts`

**intent:** 文件大小检查的输入/输出实体定义。FileSizeCheckInput 只含 filePath（绝对路径）和可选的 threshold（默认 400），已移除 workspaceRoot。FileSizeCheckResult 已移除 lineCount，needsRefactor 仅在超标时出现（可选字段）。
