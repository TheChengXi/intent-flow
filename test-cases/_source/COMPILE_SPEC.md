# COMPILE_SPEC.md

## 通用编码规范

### 基本规则
1. 使用目标语言的严格模式（如有）
2. 所有函数参数必须有类型标注（如果语言支持）
3. 所有函数必须有返回类型标注（如果语言支持）
4. 使用现代变量声明方式（const/let/final 等，避免 var）
5. 遵循语言的标准函数定义方式

### 命名规范
- 函数名：遵循目标语言惯例（camelCase 或 snake_case）
- 变量名：遵循目标语言惯例
- 类型名：遵循目标语言惯例（PascalCase 或其他）
- 常量：遵循目标语言惯例（UPPER_SNAKE_CASE 或其他）

### 代码风格
- 使用目标语言的标准缩进（2 或 4 空格）
- 遵循目标语言的语句结束符规范
- 遵循目标语言的字符串引号惯例
- 遵循目标语言的集合尾随逗号规范

### 错误处理
- 使用目标语言的标准异常机制（throw/raise/panic 等）
- 使用自定义错误类型（如果语言支持）
- 边界条件必须有明确的错误处理

### 示例（TypeScript）
```typescript
function calculateTotal(items: Item[], taxRate: number): number {
  if (items.length === 0) {
    return 0;
  }
  
  if (taxRate < 0 || taxRate > 1) {
    throw new ValidationError('taxRate must be between 0 and 1');
  }
  
  let subtotal = 0;
  for (const item of items) {
    subtotal += item.price * item.quantity;
  }
  
  const tax = subtotal * taxRate;
  return subtotal + tax;
}
```

### 示例（Python）
```python
def calculate_total(items: list[Item], tax_rate: float) -> float:
    if len(items) == 0:
        return 0.0
    
    if tax_rate < 0 or tax_rate > 1:
        raise ValidationError('tax_rate must be between 0 and 1')
    
    subtotal = 0.0
    for item in items:
        subtotal += item.price * item.quantity
    
    tax = subtotal * tax_rate
    return subtotal + tax
```

