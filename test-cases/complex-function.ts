// 测试场景 2：复杂函数（多个 @step 和 @boundary）
// 目的：验证完整的 CDD 注释编译

// @contract: calculateDiscount(price: number, discountRate: number, userLevel: string) => number
// @step: [验证] 检查 price 和 discountRate 是否有效
// @step: [计算基础折扣] 根据 discountRate 计算基础折扣金额
// @step: [应用会员等级] 根据 userLevel 应用额外折扣
// @step: [返回] 返回最终折扣后的价格
// @boundary: 当 price 小于 0 时，抛出 Error
// @boundary: 当 discountRate 不在 0-1 之间时，抛出 Error
// @boundary: 当 userLevel 不是 'bronze', 'silver', 'gold' 之一时，使用默认折扣
// @end
