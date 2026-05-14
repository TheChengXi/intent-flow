# CDD 框架快速开始指南

## 概述

本指南帮助你快速上手 CDD（Comment-Driven Development）框架，通过三个核心 Agent 函数实现注释驱动开发。

---

## 第一步：理解核心概念

### 什么是 CDD？

CDD 是一种"注释即源码"的开发方法：
- **人写注释**：定义函数要做什么
- **AI 写代码**：根据注释生成实现
- **AI 审查**：验证代码是否符合注释

### 三个核心 Agent

1. **Compiler（编译器）**：注释 → 代码
2. **Translator（转译器）**：代码 → 注释
3. **Reviewer（审查员）**：验证注释与代码一致性

---

## 第二步：编写你的第一个 CDD 注释

### 基本格式

```typescript
// @contract: functionName(param: Type) => ReturnType
// @step: [意图] 具体步骤描述
// @boundary: 当...时，应...
```

### 示例：计算两数之和

```typescript
// @contract: add(a: number, b: number) => number
// @step: [相加] 将 a 和 b 相加
// @step: [返回] 返回相加结果
// @boundary: 当 a 或 b 不是数字时，抛出 TypeError
```

### 注释编写技巧

#### ✅ 好的注释
```typescript
// @contract: validateEmail(email: string) => boolean
// @step: [检查格式] 使用正则 /^[^\s@]+@[^\s@]+\.[^\s@]+$/ 验证邮箱格式
// @step: [返回结果] 格式正确返回 true，否则返回 false
// @boundary: 当 email 为空字符串时，返回 false
```

#### ❌ 不好的注释
```typescript
// @contract: validateEmail(email: string) => boolean
// @step: [验证] 验证邮箱
// @step: [返回] 返回结果
// @boundary: 当输入无效时，返回 false
```

**问题**：
- "验证邮箱" 太模糊，没说怎么验证
- "返回结果" 没说什么结果
- "输入无效" 没说什么算无效

---

## 第三步：使用 Compiler 生成代码

### 在 VSCode 中使用

1. 编写 CDD 注释
2. 选中注释
3. 右键 → "CDD: Compile Comment to Code"
4. Compiler 生成代码并插入到注释下方

### 示例

**输入（注释）**：
```typescript
// @contract: add(a: number, b: number) => number
// @step: [相加] 将 a 和 b 相加
// @step: [返回] 返回相加结果
// @boundary: 当 a 或 b 不是数字时，抛出 TypeError
```

**输出（代码）**：
```typescript
// @contract: add(a: number, b: number) => number
// @step: [相加] 将 a 和 b 相加
// @step: [返回] 返回相加结果
// @boundary: 当 a 或 b 不是数字时，抛出 TypeError
function add(a: number, b: number): number {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Both arguments must be numbers');
  }
  
  const result = a + b;
  return result;
}
// @end
```

---

## 第四步：使用 Reviewer 审查代码

### 在 VSCode 中使用

1. 选中注释和代码（包含 @end）
2. 右键 → "CDD: Review Code"
3. Reviewer 输出审查报告

### 示例

**输入**：
```typescript
// @contract: add(a: number, b: number) => number
// @step: [相加] 将 a 和 b 相加
// @step: [返回] 返回相加结果
// @boundary: 当 a 或 b 不是数字时，抛出 TypeError
function add(a: number, b: number): number {
  return a + b; // 缺少类型检查！
}
// @end
```

**输出（审查报告）**：
```
@contract 匹配: PASS - 函数签名一致
@step 一致性: PASS - 实现了相加和返回
@boundary 处理: FAIL - 未处理类型检查，缺少 TypeError 抛出
多余行为: PASS - 无多余行为
COMPILE_SPEC 合规: SKIP - 未提供编译规范
@end 完整性: PASS - 代码块正确结束
```

### 根据审查结果修正

**修正后的代码**：
```typescript
function add(a: number, b: number): number {
  if (typeof a !== 'number' || typeof b !== 'number') {
    throw new TypeError('Both arguments must be numbers');
  }
  return a + b;
}
```

**重新审查**：
```
@contract 匹配: PASS
@step 一致性: PASS
@boundary 处理: PASS
多余行为: PASS
COMPILE_SPEC 合规: SKIP
@end 完整性: PASS
```

---

## 第五步：使用 Translator 生成注释

### 在 VSCode 中使用

1. 选中代码
2. 右键 → "CDD: Translate Code to Comment"
3. Translator 生成注释并插入到代码上方

### 示例

**输入（代码）**：
```typescript
function multiply(a: number, b: number): number {
  if (a === 0 || b === 0) {
    return 0;
  }
  return a * b;
}
```

**输出（注释）**：
```typescript
// @contract: multiply(a: number, b: number) => number
// @step: [检查零值] 如果 a 或 b 为 0，直接返回 0
// @step: [相乘] 将 a 和 b 相乘
// @step: [返回] 返回相乘结果
// @boundary: 当 a 或 b 为 0 时，返回 0
function multiply(a: number, b: number): number {
  if (a === 0 || b === 0) {
    return 0;
  }
  return a * b;
}
// @end
```

---

## 第六步：完整工作流示例

### 场景：实现用户登录验证

#### 1. 编写注释

```typescript
// @contract: validateLogin(username: string, password: string) => Promise<boolean>
// @step: [检查用户名] 验证 username 长度在 3-20 之间且只包含字母数字下划线
// @step: [检查密码] 验证 password 长度至少 8 位
// @step: [查询数据库] 调用 UserRepository.findByUsername 查询用户
// @step: [验证密码] 使用 bcrypt.compare 比对密码
// @step: [返回结果] 密码匹配返回 true，否则返回 false
// @boundary: 当 username 格式不正确时，抛出 ValidationError
// @boundary: 当 password 长度不足时，抛出 ValidationError
// @boundary: 当用户不存在时，返回 false
```

#### 2. 使用 Compiler 生成代码

选中注释 → 右键 → "CDD: Compile Comment to Code"

```typescript
// @contract: validateLogin(username: string, password: string) => Promise<boolean>
// @step: [检查用户名] 验证 username 长度在 3-20 之间且只包含字母数字下划线
// @step: [检查密码] 验证 password 长度至少 8 位
// @step: [查询数据库] 调用 UserRepository.findByUsername 查询用户
// @step: [验证密码] 使用 bcrypt.compare 比对密码
// @step: [返回结果] 密码匹配返回 true，否则返回 false
// @boundary: 当 username 格式不正确时，抛出 ValidationError
// @boundary: 当 password 长度不足时，抛出 ValidationError
// @boundary: 当用户不存在时，返回 false
async function validateLogin(username: string, password: string): Promise<boolean> {
  // 检查用户名格式
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    throw new ValidationError('Username must be 3-20 characters and contain only letters, numbers, and underscores');
  }
  
  // 检查密码长度
  if (password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }
  
  // 查询用户
  const user = await UserRepository.findByUsername(username);
  if (!user) {
    return false;
  }
  
  // 验证密码
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  return isPasswordValid;
}
// @end
```

#### 3. 使用 Reviewer 审查

选中注释和代码 → 右键 → "CDD: Review Code"

```
@contract 匹配: PASS - 函数签名一致
@step 一致性: PASS - 所有步骤都已实现
@boundary 处理: PASS - 所有边界条件都已处理
多余行为: PASS - 无多余行为
COMPILE_SPEC 合规: SKIP - 未提供编译规范
@end 完整性: PASS - 代码块正确结束
```

#### 4. 手动修改代码后使用 Translator 同步

假设你手动添加了日志记录：

```typescript
async function validateLogin(username: string, password: string): Promise<boolean> {
  console.log(`Login attempt for user: ${username}`);
  
  const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
  if (!usernameRegex.test(username)) {
    throw new ValidationError('Username must be 3-20 characters and contain only letters, numbers, and underscores');
  }
  
  if (password.length < 8) {
    throw new ValidationError('Password must be at least 8 characters');
  }
  
  const user = await UserRepository.findByUsername(username);
  if (!user) {
    console.log(`User not found: ${username}`);
    return false;
  }
  
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  console.log(`Login ${isPasswordValid ? 'successful' : 'failed'} for user: ${username}`);
  return isPasswordValid;
}
```

选中代码 → 右键 → "CDD: Translate Code to Comment"

Translator 会生成更新的注释：

```typescript
// @contract: validateLogin(username: string, password: string) => Promise<boolean>
// @step: [记录日志] 记录登录尝试
// @step: [检查用户名] 验证 username 长度在 3-20 之间且只包含字母数字下划线
// @step: [检查密码] 验证 password 长度至少 8 位
// @step: [查询数据库] 调用 UserRepository.findByUsername 查询用户
// @step: [记录未找到] 如果用户不存在，记录日志
// @step: [验证密码] 使用 bcrypt.compare 比对密码
// @step: [记录结果] 记录登录成功或失败
// @step: [返回结果] 密码匹配返回 true，否则返回 false
// @boundary: 当 username 格式不正确时，抛出 ValidationError
// @boundary: 当 password 长度不足时，抛出 ValidationError
// @boundary: 当用户不存在时，返回 false
```

---

## 常见问题

### Q1: 什么时候用 @step，什么时候用 @boundary？

**@step**：描述正常流程的步骤
- 做什么操作
- 调用什么函数
- 返回什么结果

**@boundary**：描述异常情况和边界条件
- 当输入无效时
- 当资源不存在时
- 当操作失败时

### Q2: @step 应该写多详细？

**原则**：精确到"人类审查员能明确判断对错"

**太模糊**：
```typescript
// @step: [验证] 验证输入
```

**太详细**：
```typescript
// @step: [声明变量] 声明变量 isValid
// @step: [赋值] 将 isValid 赋值为 true
// @step: [检查] 如果 input 为空，将 isValid 设为 false
// @step: [返回] 返回 isValid
```

**刚刚好**：
```typescript
// @step: [验证输入] 检查 input 不为空且长度在 1-100 之间
// @step: [返回结果] 验证通过返回 true，否则返回 false
```

### Q3: Compiler 生成的代码不符合预期怎么办？

**可能原因**：
1. 注释不够精确 → 改进注释
2. 缺少依赖契约 → 提供 referencedContracts
3. 编译规范不清晰 → 更新 COMPILE_SPEC

**解决步骤**：
1. 检查注释是否精确描述了预期行为
2. 使用 Reviewer 审查，看哪个维度 FAIL
3. 根据 FAIL 原因修正注释或代码
4. 重新编译

### Q4: Translator 生成的注释信息不完整怎么办？

**这是正常的**：Translator 无法从代码中提取所有信息，特别是：
- 算法选择的原因
- 性能优化的意图
- 错误处理的策略

**解决方法**：
1. 手动补充缺失的信息
2. 在注释中添加 @hint 说明实现细节
3. 接受一定的信息损失（目标 60-70% 保留率）

### Q5: 如何处理复杂的函数？

**原则**：函数预计超过 200 行时，考虑拆分

**拆分策略**：
1. 按职责拆分（单一职责原则）
2. 提取子函数（每个 @step 可能是一个子函数）
3. 使用组合而非继承

**示例**：

**拆分前**（复杂）：
```typescript
// @contract: processOrder(order: Order) => Promise<OrderResult>
// @step: [验证订单] 验证订单信息完整性
// @step: [检查库存] 检查所有商品库存
// @step: [计算价格] 计算订单总价和折扣
// @step: [创建支付] 创建支付订单
// @step: [扣减库存] 扣减商品库存
// @step: [发送通知] 发送订单确认邮件
// @step: [记录日志] 记录订单处理日志
// @step: [返回结果] 返回订单处理结果
```

**拆分后**（简洁）：
```typescript
// @contract: processOrder(order: Order) => Promise<OrderResult>
// @step: [验证订单] 调用 validateOrder 验证订单
// @step: [检查库存] 调用 checkInventory 检查库存
// @step: [计算价格] 调用 calculatePrice 计算价格
// @step: [创建支付] 调用 createPayment 创建支付
// @step: [扣减库存] 调用 deductInventory 扣减库存
// @step: [发送通知] 调用 sendNotification 发送通知
// @step: [返回结果] 返回订单处理结果

// @contract: validateOrder(order: Order) => void | throws ValidationError
// @step: [检查必填] 检查订单号、用户ID、商品列表不为空
// @step: [检查格式] 检查订单号格式、用户ID格式
// @boundary: 当必填字段为空时，抛出 ValidationError
// @boundary: 当格式不正确时，抛出 ValidationError

// @contract: checkInventory(items: OrderItem[]) => Promise<boolean>
// @step: [遍历商品] 遍历所有订单商品
// @step: [查询库存] 调用 InventoryRepository.getStock 查询库存
// @step: [比对数量] 比对订单数量和库存数量
// @step: [返回结果] 所有商品库存充足返回 true，否则返回 false
// @boundary: 当库存不足时，返回 false

// ... 其他子函数
```

---

## 下一步

### 学习更多

- 阅读 [CDD_v3.md](./CDD_v3.md) 了解完整规范
- 阅读 [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) 了解实施计划
- 查看 `_source/prompts/` 目录了解 Agent 函数规范

### 实践项目

1. **个人项目**：为你的个人项目添加 CDD 注释
2. **开源贡献**：为开源项目添加 CDD 注释
3. **团队协作**：在团队中推广 CDD 方法

### 参与改进

- 报告问题：在 GitHub Issues 中报告 bug
- 提出建议：在 GitHub Discussions 中讨论改进
- 贡献代码：提交 Pull Request

---

## 附录：注释模板

### 简单函数模板

```typescript
// @contract: functionName(param: Type) => ReturnType
// @step: [步骤1] 描述
// @step: [步骤2] 描述
// @boundary: 当...时，应...
```

### 异步函数模板

```typescript
// @contract: functionName(param: Type) => Promise<ReturnType>
// @step: [步骤1] 描述
// @step: [步骤2] 调用异步函数
// @step: [步骤3] 处理结果
// @boundary: 当...时，应...
```

### 抛出异常的函数模板

```typescript
// @contract: functionName(param: Type) => ReturnType | throws ErrorType
// @step: [验证] 验证输入
// @step: [处理] 处理逻辑
// @step: [返回] 返回结果
// @boundary: 当输入无效时，抛出 ErrorType
```

### 复杂函数模板

```typescript
// @contract: functionName(param1: Type1, param2: Type2) => Promise<ReturnType> | throws ErrorType
// @step: [验证输入] 验证 param1 和 param2
// @step: [调用依赖] 调用 DependencyService.method
// @step: [处理数据] 处理返回的数据
// @step: [保存结果] 调用 Repository.save 保存结果
// @step: [返回] 返回处理结果
// @boundary: 当 param1 无效时，抛出 ValidationError
// @boundary: 当 param2 无效时，抛出 ValidationError
// @boundary: 当依赖调用失败时，抛出 ServiceError
// @boundary: 当保存失败时，抛出 RepositoryError
```

---

**文档版本**：1.0  
**创建日期**：2026-05-14  
**最后更新**：2026-05-14
