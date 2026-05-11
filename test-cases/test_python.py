# Python 多语言测试文件
# 测试今天修复的内容：
# 1. Parser 支持多语言注释符（# 和 //）
# 2. 动态 @end 标记生成（根据语言自动添加注释符）
# 3. 审查员拒绝非代码内容
# 4. @boundary 正确解析和保存

# @contract: calculate_discount(price: float, discount_rate: float) => float
# @step: [验证输入] 检查 price 大于 0，discount_rate 在 0-1 之间
# @step: [计算折扣] price * (1 - discount_rate)
# @step: [返回结果] 返回折扣后的价格
# @boundary: 当 price 小于等于 0 时，抛出 ValueError
# @boundary: 当 discount_rate 超出范围时，抛出 ValueError
