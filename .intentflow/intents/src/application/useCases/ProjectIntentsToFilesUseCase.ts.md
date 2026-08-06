# ProjectIntentsToFilesUseCase.ts

`src/application/useCases/ProjectIntentsToFilesUseCase.ts`

**intent:** 将项目中每个文件的 @intent 注释实时映射到 .intentflow/intents/ 目录树。 每个源文件 → 一个 .md 文件（含路径 + @intent 原文）。 agent 可直接用 ls/cat/grep 扫 .intentflow/intents/ 快速了解项目全貌。 不含 LLM 调用，纯 IO + 字符串匹配。
