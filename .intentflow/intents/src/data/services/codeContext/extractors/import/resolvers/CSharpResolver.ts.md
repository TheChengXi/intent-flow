# CSharpResolver.ts

`src/data/services/codeContext/extractors/import/resolvers/CSharpResolver.ts`

**intent:** C# 的 import 解析策略。 using System; / using System.Collections.Generic; → 命名空间到文件路径的映射。 C# using 语句是命名空间引用，本地项目代码通常遵循目录=命名空间的约定。 边界：标准库命名空间（System.*）会尝试解析但由 fileRepo.exists 过滤。
