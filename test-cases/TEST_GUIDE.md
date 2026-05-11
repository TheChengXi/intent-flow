# 跨文件引用功能测试用例

## 测试环境

- 工作区：`d:\w_dev\cdd`
- 测试文件目录：`test-cases/`

## 测试文件说明

### 1. userService.ts
包含两个已实现的函数及其契约：
- `validateUser(userId: string) => Promise<boolean>` - 验证用户是否存在
- `getUserInfo(userId: string) => Promise<UserInfo>` - 获取用户信息

### 2. testCase1_withImport.ts
**测试场景**：有 import 语句的情况

**预期行为**：
1. 选中 `@contract: processUser` 注释
2. 执行 `CDD: 编译注释为代码`
3. 编译器应该：
   - 从 `import { validateUser, getUserInfo } from './userService'` 中识别出导入的文件
   - 在 `userService.ts` 中找到 `validateUser` 和 `getUserInfo` 的契约
   - 将这些契约传递给 AI
   - 生成正确调用这两个函数的代码
4. 不应该弹出任何提示框（因为在导入的文件中找到了契约）

**验证点**：
- 生成的代码应该正确调用 `await validateUser(userId)`
- 生成的代码应该正确调用 `await getUserInfo(userId)`
- 生成的代码应该处理返回值类型（boolean 和 UserInfo 对象）

### 3. testCase2_withoutImport.ts
**测试场景**：没有 import 语句的情况

**预期行为**：
1. 选中 `@contract: processUserWithoutImport` 注释
2. 执行 `CDD: 编译注释为代码`
3. 编译器应该：
   - 发现代码中调用了 `validateUser` 和 `getUserInfo`
   - 在导入的文件中找不到这些函数（因为没有 import）
   - 弹出提示："在导入的文件中未找到以下函数的契约：validateUser, getUserInfo。是否在整个工作区搜索？"
4. 用户选择"搜索"后：
   - 在工作区中找到 `userService.ts` 中的契约
   - 弹出提示："找到 validateUser 的契约（位于 test-cases/userService.ts），是否添加导入语句？"
   - 弹出提示："找到 getUserInfo 的契约（位于 test-cases/userService.ts），是否添加导入语句？"
5. 用户选择"添加"后：
   - 显示提示："请在文件顶部添加：import { validateUser } from './userService';"
   - 显示提示："请在文件顶部添加：import { getUserInfo } from './userService';"

**验证点**：
- 提示框应该按预期弹出
- 提示的文件路径应该正确（相对路径）
- 建议的 import 语句应该正确

### 4. testCase3_python.py
**测试场景**：Python 语言的跨文件引用

**预期行为**：
- 测试 Python 的 `from ... import ...` 语法
- 验证 `#` 注释符号的支持
- 验证生成的代码使用 `# @end` 标记

## 测试步骤

### 步骤 1：测试有 import 的情况
1. 打开 `testCase1_withImport.ts`
2. 选中从 `// @contract: processUser` 到 `// @boundary` 的所有注释
3. 右键选择 `CDD: 编译注释为代码`
4. 观察是否有提示框弹出（不应该有）
5. 检查生成的代码是否正确调用了 `validateUser` 和 `getUserInfo`

### 步骤 2：测试没有 import 的情况
1. 打开 `testCase2_withoutImport.ts`
2. 选中从 `// @contract: processUserWithoutImport` 到 `// @boundary` 的所有注释
3. 右键选择 `CDD: 编译注释为代码`
4. 应该弹出提示："在导入的文件中未找到以下函数的契约..."
5. 点击"搜索"
6. 应该弹出提示："找到 validateUser 的契约..."
7. 点击"添加"或"跳过"
8. 重复上一步，处理 `getUserInfo`
9. 检查生成的代码

### 步骤 3：测试 Python
1. 打开 `testCase3_python.py`
2. 选中注释
3. 执行编译
4. 验证 Python 语法的正确性

## 预期结果

### 成功标准
- ✅ 有 import 时自动找到契约，无需用户干预
- ✅ 没有 import 时提示用户选择是否全局搜索
- ✅ 全局搜索找到契约后提示用户添加 import
- ✅ 生成的代码正确调用引用的函数
- ✅ 多语言支持正常工作

### 失败情况处理
- ❌ 如果没有弹出提示框：检查 `extractReferencedContracts` 是否被正确调用
- ❌ 如果找不到契约：检查 `searchContractInFile` 的文件路径解析
- ❌ 如果 import 建议错误：检查 `searchContractInWorkspaceWithPath` 的路径计算逻辑

## 调试建议

如果测试失败，可以：
1. 打开 VSCode 开发者工具（Help > Toggle Developer Tools）
2. 查看 Console 中的 `[CDD]` 日志
3. 检查是否有错误信息
4. 验证文件路径是否正确解析

## 注意事项

- 确保 `userService.ts` 中的契约格式正确
- 确保测试文件在同一个工作区内
- 第一次测试时可能需要等待 AI API 响应（约 5-10 秒）
- 如果使用 ModelScope API，可能会遇到速率限制，建议使用 DeepSeek 官方 API
