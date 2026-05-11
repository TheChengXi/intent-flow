// 增量编译测试文件

// @contract: calculateTotal(items: Item[], taxRate: number) => number
// @step: [验证输入] 检查 items 数组不为空，taxRate 在 0-1 之间
// @step: [计算小计] 遍历 items，累加每个 item.price * item.quantity
// @step: [计算税额] 小计 * taxRate 得到税额
// @step: [返回总额] 返回小计 + 税额
// @boundary: 当 items 为空时，返回 0
// @boundary: 当 taxRate 超出范围时，抛出 ValidationError

// 这个函数将用于测试增量编译
// 我们会修改部分 @step 来触发增量编译
