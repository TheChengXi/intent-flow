# RubyResolver.ts

`src/data/services/codeContext/extractors/import/resolvers/RubyResolver.ts`

**intent:** Ruby 的 import 解析策略。 处理 require / require_relative / load 三种加载语句。 所有 require 都尝试解析为 .rb 文件。 边界：gem require 会尝试路径解析失败后静默跳过。
