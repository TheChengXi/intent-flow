# JavaResolver.ts

`src/data/services/codeContext/extractors/import/resolvers/JavaResolver.ts`

**intent:** Java 的 import 解析策略。 import com.example.Module; → com/example/Module.java 的包绝对路径解析。 所有 Java import 都是包路径（无外部包过滤），一律解析。 边界：通配符导入（.*）和 java.* 标准库跳过。
