// 增量编译测试 - 场景2：用户认证流程

// @contract: authenticateUser(username: string, password: string) => AuthResult
// @step: [验证格式] 检查 username 和 password 格式是否合法
// @step: [查询用户] 从数据库查询用户信息
// @step: [验证密码] 使用 bcrypt 比对密码哈希
// @step: [生成令牌] 生成 JWT token
// @step: [记录日志] 记录登录成功日志
// @step: [返回结果] 返回包含 token 和用户信息的 AuthResult
// @boundary: 当用户不存在时，返回 { success: false, error: 'USER_NOT_FOUND' }
// @boundary: 当密码错误时，返回 { success: false, error: 'INVALID_PASSWORD' }

// 这个函数有6个步骤，我们会修改其中2个来测试增量编译（约33%变化）
