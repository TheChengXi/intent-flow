# GoResolver.ts

`src/data/services/codeContext/extractors/import/resolvers/GoResolver.ts`

**intent:** Go 的 import 解析策略。 import "path" / import ( "path1" "path2" ) 两种形式。 边界：只解析相对路径（./ ../），标准库和模块路径跳过。
