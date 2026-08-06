# RustResolver.ts

`src/data/services/codeContext/extractors/import/resolvers/RustResolver.ts`

**intent:** Rust 的 import 解析策略。 处理 use 声明（crate::module::Item）和 mod 声明（mod module;）。 路径解析用多候选策略：原样路径 / + /mod.rs / -最后一段 / -最后一段+mod.rs。 边界：只解析 crate::/self::/super:: 开头的路径，外部 crate 跳过。
