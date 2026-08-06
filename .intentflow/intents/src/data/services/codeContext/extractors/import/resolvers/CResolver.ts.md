# CResolver.ts

`src/data/services/codeContext/extractors/import/resolvers/CResolver.ts`

**intent:** C 语言的 import 解析策略。只处理 #include 预处理器指令。 注意：C 没有 C++ 的 import 模块声明，C++ 的 import 模块在 CppResolver 中处理。 边界：系统库 <...> 和本地 "..." 均尝试解析。
