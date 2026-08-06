# TreeSitterManager.ts

`src/data/services/tree-sitter/TreeSitterManager.ts`

**intent:** 对 Tree-sitter Parser 的统一管理（初始化 + 语言加载 + 多语言缓存）。 基于 @vscode/tree-sitter-wasm 运行时，支持新版 tree-sitter WASM 格式（dylink 而非 dylink.0）。 定义：init() → 初始化 Parser 实例；getParser() → 返回单例 parser； getLanguage(lang) → 加载对应 WASM 并缓存 Language 对象；clearCache() → 重置全部状态。 被哪些消费者使用： - CodeParserService / IntentExtractor：通过它获取 Parser 和 Language 进行 AST 解析 屏蔽了什么实现细节：WASM 文件路径解析、Language.load 异步初始化、多语言缓存复用。
