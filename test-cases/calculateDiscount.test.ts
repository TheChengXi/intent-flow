// 测试场景 5：测试文件
// 目的：验证测试规范自动选择（COMPILE_SPEC_TEST.md）
// 路径匹配：**/*.test.ts 应该使用测试规范

// @contract: testCalculateDiscount() => void
// @step: [准备测试数据] 创建测试用的价格和折扣率
// @step: [调用函数] 调用 calculateDiscount 函数
// @step: [断言结果] 验证返回值是否符合预期
// @step: [测试边界] 测试异常情况
// @boundary: 当测试失败时，抛出 AssertionError


// @end
