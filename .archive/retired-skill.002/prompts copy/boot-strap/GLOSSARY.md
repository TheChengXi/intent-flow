## @intent

文件级注释，描述"为什么这个文件存在，这个文件负责什么职能"——而不是"这个文件叫什么"。

**核心原则**：只表达 import、类型签名、dependency_chain 看不出来的信息。看得见的（依赖谁、输入输出类型、被谁调用）不写。

**示例**：
```
// ❌ 冗余：这些信息 import 和类型签名已经表达了
/**
 * @intent
 * 依赖 UserRepository
 * 输入：userId: string
 * 输出：User | null
 * 被 UserController 调用
 */

// ✅ 精简：只说看不出来的
/**
 * @intent
 * 用户数据持久化的抽象边界，屏蔽数据库选型。
 * 边界：findById 返回 null 表示不存在，不抛异常。
 */
```

## @entity

标记数据实体。与 @intent 一起使用，标识核心业务对象。

---
