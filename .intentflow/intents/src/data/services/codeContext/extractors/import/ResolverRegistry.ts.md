# ResolverRegistry.ts

`src/data/services/codeContext/extractors/import/ResolverRegistry.ts`

**intent:** 全局静态注册表，将语言名映射到对应的 ImportResolver 实例。 register(resolver, ...aliases) 一次注册 + 多个别名（如 TS/JS/TSX 共用一个）。 get(lang) 供 ImportExtractor 调度器查表分发。 同语言重复注册发出警告并用后者覆盖（方便测试 mock）。
