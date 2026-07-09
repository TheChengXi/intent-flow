# 注释规范参考

## @contract

**用途**：方法契约，描述输入、输出、副作用。

**位置**：方法签名上方。

**包含**：
- 输入参数的约束
- 返回值的格式
- 可能抛出的错误
- 副作用（写库、调外部 API 等）

**示例**：
```
/**
 * @contract
 * 根据用户 ID 查询用户信息。
 * 输入：id - 用户唯一标识（UUID 格式）
 * 输出：User | null - 用户信息，不存在时返回 null
 * 错误：DatabaseError - 数据库查询失败
 * 副作用：无
 */
async findById(id: string): Promise<User | null>
```

## @step

**用途**：实现步骤，描述方法的执行流程。

**位置**：方法体内部，标注关键步骤。

**包含**：
- 按顺序的执行步骤
- 每个步骤的目的
- 条件分支的关键判断点

**示例**：
```
async createUser(data: CreateUserDto): Promise<User> {
  // @step: 验证输入参数合法性
  this.validateCreateInput(data);

  // @step: 检查邮箱是否已注册
  const existing = await this.userRepo.findByEmail(data.email);
  if (existing) {
    throw new ConflictError('Email already registered');
  }

  // @step: 密码加密
  const hashedPassword = await this.hashService.hash(data.password);

  // @step: 保存用户到数据库
  const user = await this.userRepo.create({
    ...data,
    password: hashedPassword,
    createdAt: new Date()
  });

  // @step: 发送欢迎邮件（异步，不阻塞）
  this.emailService.sendWelcome(user.email).catch(console.error);

  return user;
}
```

## @boundary

**用途**：边界定义，描述输入验证、输出格式、错误处理。

**位置**：方法签名上方或方法体内部。

**包含**：
- 输入验证规则
- 输出格式规范
- 错误类型和处理方式

**示例**：
```
/**
 * @boundary
 * 输入验证：
 *   - email: 必须是有效邮箱格式
 *   - password: 至少 8 位，包含字母和数字
 * 输出：创建成功的 User 对象（不含密码字段）
 * 错误：
 *   - ValidationError: 输入参数不合法
 *   - ConflictError: 邮箱已被注册
 */
async createUser(data: CreateUserDto): Promise<User>
```