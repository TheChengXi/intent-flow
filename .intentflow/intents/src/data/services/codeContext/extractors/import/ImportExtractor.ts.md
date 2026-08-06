# ImportExtractor.ts

`src/data/services/codeContext/extractors/import/ImportExtractor.ts`

**intent:** 多语言 import 解析的统一调度入口。 有 language 参数时查 ResolverRegistry 获取对应的策略实现， Tree-sitter 失败时降级到该策略的正则方案。 无 language 参数时走旧全局正则（向后兼容）。 不再持有语言分支逻辑——加语言 = 加 resolver + 注册，不改此文。
