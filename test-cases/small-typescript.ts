// 小型 TypeScript 测试用例：用户认证函数

export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  user?: User;
  error?: string;
}

// @contract: authenticateUser(username: string, password: string, database: any) => Promise<AuthResult>
// @step: [验证] 检查用户名和密码不为空
// @step: [验证] 检查用户名长度在 3-50 字符范围内
// @step: [查询] 从数据库查找用户
// @step: [验证] 检查用户存在且账户已激活
// @step: [验证] 使用 bcrypt 比对密码哈希
// @step: [生成] 使用 JWT 签名生成访问令牌
// @step: [返回] 返回成功结果及用户信息和令牌
// @boundary: 当用户名或密码为空时，返回失败且错误信息为"Username and password are required"
// @boundary: 当用户名长度不在 3-50 字符范围内时，返回失败且错误信息为"Username must be between 3 and 50 characters"
// @boundary: 当数据库中不存在该用户时，返回失败且错误信息为"Invalid credentials"
// @boundary: 当用户账户未激活时，返回失败且错误信息为"Account is disabled"
// @boundary: 当密码与哈希值不匹配时，返回失败且错误信息为"Invalid credentials"
// @end
export async function authenticateUser(
  username: string,
  password: string,
  database: any
): Promise<AuthResult> {
  if (!username || !password) {
    return {
      success: false,
      error: 'Username and password are required'
    };
  }

  if (username.length < 3 || username.length > 50) {
    return {
      success: false,
      error: 'Username must be between 3 and 50 characters'
    };
  }

  const user = await database.findUserByUsername(username);

  if (!user) {
    return {
      success: false,
      error: 'Invalid credentials'
    };
  }

  if (!user.isActive) {
    return {
      success: false,
      error: 'Account is disabled'
    };
  }

  const bcrypt = require('bcrypt');
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    return {
      success: false,
      error: 'Invalid credentials'
    };
  }

  const jwt = require('jsonwebtoken');
  const token = jwt.sign(
    { userId: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  return {
    success: true,
    token: token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      passwordHash: user.passwordHash,
      isActive: user.isActive
    }
  };
}
