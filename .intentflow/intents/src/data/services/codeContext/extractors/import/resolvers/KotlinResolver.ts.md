# KotlinResolver.ts

`src/data/services/codeContext/extractors/import/resolvers/KotlinResolver.ts`

**intent:** Kotlin 的 import 解析策略。 import com.example.Module → com/example/Module.kt 的包绝对路径解析。 与 Java 的机制相同：点号转路径分隔符 + .kt 后缀。 边界：通配符导入（.*）和 kotlin.* 标准库跳过。
