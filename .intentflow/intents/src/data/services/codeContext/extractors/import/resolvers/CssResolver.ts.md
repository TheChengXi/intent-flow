# CssResolver.ts

`src/data/services/codeContext/extractors/import/resolvers/CssResolver.ts`

**intent:** CSS 的 import 解析策略。 处理 @import url("...") 和 @import "..." 两种导入语法。 边界：只解析相对路径（./ ../），外部 CDN 链接跳过。
