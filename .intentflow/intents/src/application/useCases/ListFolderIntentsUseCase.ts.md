# ListFolderIntentsUseCase.ts

`src/application/useCases/ListFolderIntentsUseCase.ts`

**intent:** 扫描指定文件夹（非递归），提取每个文件的 @intent 注释，以结构化意图清单返回。 编排两个数据层能力：IFileRepository（文件扫描）+ IntentExtractorFn（意图提取）。 输入：folderPath；输出：{ folder, subdirectories, files: { file, intent }[] }。 不含 LLM 调用，纯 IO + 字符串匹配。 被 MCP Tool 和 CLI Command 共同消费。
