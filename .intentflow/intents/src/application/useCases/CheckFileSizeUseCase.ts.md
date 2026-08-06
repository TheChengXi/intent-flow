# CheckFileSizeUseCase.ts

`src/application/useCases/CheckFileSizeUseCase.ts`

**intent:** 编排 fileRepo 读取文件 + parserRepo 排除注释统计代码行数 → 判断是否超过阈值。输入只含 filePath（绝对路径）和可选 threshold（默认 400），已移除 workspaceRoot。needsRefactor 仅在超标时输出。
