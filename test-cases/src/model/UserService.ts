// 测试场景 4：后端服务函数
// 目的：验证后端规范自动选择（COMPILE_SPEC_BACKEND.md）
// 路径匹配：src/model/** 应该使用后端规范

// @contract: getUserById(userId: string) => Promise<User>
// @step: [验证输入] 检查 userId 是否有效
// @step: [查询数据库] 从数据库中查询用户信息
// @step: [转换数据] 将数据库记录转换为 User 对象
// @step: [返回] 返回 User 对象
// @boundary: 当 userId 为空时，抛出 ValidationError
// @boundary: 当用户不存在时，抛出 NotFoundError
// @boundary: 当数据库连接失败时，抛出 DatabaseError
// @end
