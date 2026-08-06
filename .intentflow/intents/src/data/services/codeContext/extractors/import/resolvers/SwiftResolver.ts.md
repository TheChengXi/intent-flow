# SwiftResolver.ts

`src/data/services/codeContext/extractors/import/resolvers/SwiftResolver.ts`

**intent:** Swift 的 import 解析策略。 import Foundation / import AppModule → 模块名到文件路径的猜测解析。 Swift 模块名不直接映射到文件路径，但本地项目模块通常对应同名 .swift 文件。 边界：标准库模块（Foundation/UIKit 等）会尝试解析但由 fileRepo.exists 过滤。
