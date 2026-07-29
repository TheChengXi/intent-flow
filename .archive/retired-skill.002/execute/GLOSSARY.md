## @intent

文件级注释，描述"为什么这个文件存在，这个文件负责什么职能"——而不是"这个文件叫什么"。

**核心原则**：只表达 import、类型签名、dependency_chain 看不出来的信息。
看得见的（依赖谁、输入输出类型、被谁调用）不写。

**模板**：

```typescript
/**
 * @intent
 * {一句话：这个文件在业务上做什么、为什么存在}
 *
 * 边界：{import 看不出来的行为边界：什么情况下报错/返回空/fallback}
 *
 * 验收条件：
 * - {子 agent 写完能自己检查的完成标准}
 * - {至少一条，让 agent 能自证「我做完了」}
 */
```

**示例对比**：

```typescript
// ❌ 只说了 import 已经说出来的信息
/**
 * @intent
 * 依赖 UserRepository
 * 输入：userId: string
 * 输出：User | null
 */

// ✅ 只说不看代码看不出来的信息
/**
 * @intent
 * 用户数据持久化的抽象边界，屏蔽数据库选型。
 * 边界：findById 返回 null 表示不存在，不抛异常。
 * 验收条件：
 * - 不存在用户返回 null，不抛异常
 * - 数据库连接失败时抛 PersistenceError
 */
```

## @entity

标记数据实体。与 @intent 一起使用，标识核心业务对象。

---
