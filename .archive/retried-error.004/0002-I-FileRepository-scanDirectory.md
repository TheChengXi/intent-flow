---
name: IFileRepository-scanDirectory
type: reference
---

# `IFileRepository` 缺少 `scanDirectory` 导致的架构违规

**发现时间：** 2026-06-14

**来源：** `MCP_DATA_LAYER_ANALYSIS.md` §12.1（该报告写于 2026-06-10，大部分内容已过时，但这个问题是真实的）。

**问题链：**
1. `IFileRepository` 只定义了 `readFile`/`exists`/`writeFile` 等单文件操作，没有目录扫描能力。
2. 结果：`AnalyzeCallGraphUseCase` 自己实现了一个私有的 `scanDirectory` + `fs.readdirSync` + `fs.readFileSync`，完全绕过 `IFileRepository`。
3. 双层违规：既绕过了接口抽象，又用了同步 API 阻塞事件循环。

**修复：**
- `IFileRepository` 新增 `scanDirectory(dirPath, options?)` 方法
- `FileSystemRepository` 用 `fs.promises.readdir` 实现，递归/扩展名过滤
- `AnalyzeCallGraphUseCase` 构造函数注入 `IFileRepository`，删除 `fs` 依赖

**注意：** 报告还提到了 `CodeParserRepositoryImpl` 直接使用 `fs`——经核实，该文件已在此前重构中修复（改用 searcher/extractor 委托模式），该问题不存在了。
