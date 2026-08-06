# CodeParserRepositoryImpl.ts

`src/data/services/codeParser/CodeParserRepositoryImpl.ts`

**intent:** ICodeParserRepository 实现，编排多个 tree-sitter 分析器对外提供统一接口。countNonCommentLines 复用 LanguageConfig 的扩展名映射 + tree-sitter AST 遍历识别 comment 节点，排除注释行后返回纯代码行数。
