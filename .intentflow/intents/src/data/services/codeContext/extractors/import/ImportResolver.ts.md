# ImportResolver.ts

`src/data/services/codeContext/extractors/import/ImportResolver.ts`

**intent:** 多语言 import 解析的策略接口。每种语言（或语言族）实现此接口， 封装 AST 节点匹配、路径过滤、路径解析和正则降级四步逻辑。 加一种语言 = 新建一个实现类 + 注册一行，不改 ImportExtractor 本体。
