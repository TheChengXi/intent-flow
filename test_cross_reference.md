# 跨文件引用功能测试指南

## 功能说明

现在 CDD 编译器支持跨文件引用功能，可以自动提取被调用函数的契约并传递给 AI。

## 工作流程

1. **优先使用 import/include**
   - 从代码中提取 import/require/include 语句
   - 在导入的文件中搜索被调用函数的契约
   - 快速精准，适合大多数场景

2. **全局搜索兜底**
   - 如果在导入的文件中找不到契约
   - 询问用户是否在整个工作区搜索
   - 用户可以选择"搜索"或"跳过"

3. **便捷导入建议**
   - 通过全局搜索找到契约后
   - 询问用户是否添加导入语句
   - 提示用户需要添加的 import 代码

## 支持的语言

- **TypeScript/JavaScript**: `import ... from '...'` 和 `require('...')`
- **Python**: `from ... import ...` 和 `import ...`
- **C/C++**: `#include "..."`
- **Go**: `import "..."`

## 测试场景

### 场景 1：已有 import 语句

```typescript
import { validateUser } from './userService';

// @contract: processUser(userId: string) => Promise<User>
// @step: [验证] 调用 validateUser 验证用户
// @step: [处理] 处理用户数据
// @step: [返回] 返回用户对象
```

**预期行为**：
- 自动在 `./userService.ts` 中查找 `validateUser` 的契约
- 如果找到，将契约传递给编译器
- 编译器生成的代码会正确调用 `validateUser`

### 场景 2：缺少 import 语句

```typescript
// @contract: processUser(userId: string) => Promise<User>
// @step: [验证] 调用 validateUser 验证用户
// @step: [处理] 处理用户数据
// @step: [返回] 返回用户对象
```

**预期行为**：
1. 在导入的文件中找不到 `validateUser`
2. 弹出提示："在导入的文件中未找到以下函数的契约：validateUser。是否在整个工作区搜索？"
3. 用户选择"搜索"
4. 找到契约后，弹出提示："找到 validateUser 的契约（位于 src/userService.ts），是否添加导入语句？"
5. 用户选择"添加"
6. 显示提示："请在文件顶部添加：import { validateUser } from './userService';"

### 场景 3：Python 示例

```python
from user_service import validate_user

# @contract: process_user(user_id: str) -> User
# @step: [验证] 调用 validate_user 验证用户
# @step: [处理] 处理用户数据
# @step: [返回] 返回用户对象
```

**预期行为**：
- 自动在 `user_service.py` 中查找 `validate_user` 的契约
- 正确处理 Python 的导入语法

## 注意事项

1. **相对路径优先**：只处理相对路径的 import（`./` 或 `../` 开头）
2. **性能优化**：全局搜索限制在 100 个文件内
3. **多扩展名支持**：自动尝试 `.ts`, `.js`, `.tsx`, `.jsx` 等扩展名
4. **内置函数过滤**：自动过滤 `console.log`, `setTimeout` 等内置函数

## 下一步优化

- [ ] 支持自动添加 import 语句（而不是只提示）
- [ ] 支持 VSCode 的 Quick Fix 功能
- [ ] 缓存搜索结果以提高性能
- [ ] 支持更多语言的导入语法
