# TraceDependencyChainUseCase.ts

`src/application/useCases/TraceDependencyChainUseCase.ts`

**intent:** 编排 ICodeParserRepository（解析 import）和 IFileRepository（读取文件）的数据， 产出 TraceDependencyChainOutput 供 TraceDependencyChainTool（Adapter/MCP）使用。 职责细分： - 读取入口文件 → 解析 import 列表 → 对每个依赖提取 @intent → 按同层/跨层分组 依赖接口： - ICodeParserRepository（Data）：解析 TypeScript import 语句，处理相对路径 -> 绝对路径解析 - IFileRepository（Data）：读取文件内容、检查文件是否存在 边界：入口文件不存在时报错；依赖文件读取失败跳过单条不影响整体；无 @intent 时 fallback 为文件名。
