# TypeScriptResolver.ts

`src/data/services/codeContext/extractors/import/resolvers/TypeScriptResolver.ts`

**intent:** TypeScript/JavaScript/TSX 的 import 解析策略。 三种语言的 import 语义一致（import ... from / require()），共用一个 resolver。 边界：只解析相对路径（./ ../），外部包由 resolve 包处理。
