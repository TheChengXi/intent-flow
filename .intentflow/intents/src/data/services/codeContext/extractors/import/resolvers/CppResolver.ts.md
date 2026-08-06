# CppResolver.ts

`src/data/services/codeContext/extractors/import/resolvers/CppResolver.ts`

**intent:** C++ 的 import 解析策略。 处理 #include（传统）和 C++20/26 的 import 模块声明（import std;）。 与 CResolver 分开独立，因为 C++ 有模块系统而 C 没有。 边界：系统库和模块名不产生具体文件路径，本地 #include 尝试解析。
