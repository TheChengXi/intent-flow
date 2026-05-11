# 增量编译测试指南

## 测试文件说明

我们创建了两个测试场景来验证增量编译功能：

### 场景1: calculateTotal (incrementalTest.ts)
- **函数**: 计算购物车总额（含税）
- **步骤数**: 4个
- **历史记录**: 已有一次成功编译记录

### 场景2: authenticateUser (authTest.ts)
- **函数**: 用户认证流程
- **步骤数**: 6个
- **历史记录**: 已有一次成功编译记录

## 测试步骤

### 测试1: 50%步骤未变化（应触发增量编译）

1. 打开 `test-cases/incrementalTest.ts`
2. 修改注释，保持前2个步骤不变，修改后2个步骤：
   ```typescript
   // @contract: calculateTotal(items: Item[], taxRate: number) => number
   // @step: [验证输入] 检查 items 数组不为空，taxRate 在 0-1 之间
   // @step: [计算小计] 遍历 items，累加每个 item.price * item.quantity
   // @step: [应用折扣] 如果小计超过100，应用10%折扣  // 新增
   // @step: [计算税额] 对折扣后的金额计算税额  // 修改
   // @step: [返回总额] 返回折扣后小计 + 税额  // 修改
   ```
3. 选中整个注释块
4. 执行 "CDD: 编译注释为代码"
5. **预期结果**: 
   - 控制台显示 "编译完成：calculateTotal（增量模式）"
   - 未变化步骤占比: 50%
   - 生成的代码应保留前2个步骤的实现，只修改后面的逻辑

### 测试2: 67%步骤未变化（应触发增量编译）

1. 打开 `test-cases/authTest.ts`
2. 修改注释，保持前4个步骤不变，修改后2个步骤：
   ```typescript
   // @contract: authenticateUser(username: string, password: string) => AuthResult
   // @step: [验证格式] 检查 username 和 password 格式是否合法
   // @step: [查询用户] 从数据库查询用户信息
   // @step: [验证密码] 使用 bcrypt 比对密码哈希
   // @step: [生成令牌] 生成 JWT token
   // @step: [更新登录时间] 更新用户的 lastLoginAt 字段  // 新增
   // @step: [记录审计日志] 记录登录成功的审计日志，包含IP和设备信息  // 修改
   // @step: [返回结果] 返回包含 token 和用户信息的 AuthResult
   ```
3. 选中整个注释块
4. 执行 "CDD: 编译注释为代码"
5. **预期结果**:
   - 控制台显示 "编译完成：authenticateUser（增量模式）"
   - 未变化步骤占比: 66.7%
   - 生成的代码应保留前4个步骤的实现

### 测试3: 25%步骤未变化（应全量编译）

1. 打开 `test-cases/incrementalTest.ts`
2. 修改注释，只保留第1个步骤不变，其他全部修改：
   ```typescript
   // @contract: calculateTotal(items: Item[], taxRate: number) => number
   // @step: [验证输入] 检查 items 数组不为空，taxRate 在 0-1 之间
   // @step: [应用会员折扣] 根据用户会员等级应用不同折扣  // 新增
   // @step: [计算运费] 根据订单金额计算运费  // 新增
   // @step: [计算小计] 累加商品价格、折扣、运费  // 修改
   // @step: [计算税额] 对最终金额计算税额  // 修改
   // @step: [返回总额] 返回最终总额  // 修改
   ```
3. 选中整个注释块
4. 执行 "CDD: 编译注释为代码"
5. **预期结果**:
   - 控制台显示 "编译完成：calculateTotal"（无"增量模式"标记）
   - 未变化步骤占比: 25% < 50%，不触发增量模式
   - 全量重新编译

### 测试4: 首次编译（无历史记录）

1. 创建新文件 `test-cases/newFunction.ts`
2. 添加注释：
   ```typescript
   // @contract: formatDate(date: Date, format: string) => string
   // @step: [验证输入] 检查 date 是否为有效的 Date 对象
   // @step: [解析格式] 解析 format 字符串中的占位符
   // @step: [替换占位符] 将占位符替换为对应的日期部分
   // @step: [返回结果] 返回格式化后的字符串
   ```
3. 选中整个注释块
4. 执行 "CDD: 编译注释为代码"
5. **预期结果**:
   - 控制台显示 "编译完成：formatDate"（无"增量模式"标记）
   - 因为没有历史记录，执行全量编译

## 验证要点

### 1. 增量模式触发条件
- ✅ 存在历史记录
- ✅ 上次编译成功
- ✅ 未变化步骤占比 >= 50%
- ✅ 没有审查不通过的记录

### 2. 增量编译提示词检查
打开 `.cdd/history/incrementalTest/calculateTotal.json`，查看最新的编译记录，应该包含：
- `input.parsedComment` - 解析后的注释结构
- 提示词中应包含 "## 增量编译模式" 部分
- 列出未变化、新增、删除的步骤

### 3. 生成代码质量
- 未变化步骤的实现应该保持一致
- 新增步骤的实现应该正确插入
- 删除步骤的代码应该被移除
- 整体代码逻辑应该连贯

## 调试技巧

### 查看步骤哈希
在 CompilerContextManager.prepare() 中添加日志：
```typescript
if (stepDiff) {
  console.log('步骤差异检测结果:');
  console.log('- 未变化:', stepDiff.unchanged.length);
  console.log('- 新增:', stepDiff.added.length);
  console.log('- 删除:', stepDiff.deleted.length);
  console.log('- 占比:', (stepDiff.unchangedRatio * 100).toFixed(1) + '%');
}
```

### 查看历史记录
```bash
cat test-cases/.cdd/history/incrementalTest/calculateTotal.json | jq '.history[-1].input.parsedComment.steps'
```

### 手动计算哈希
使用 Node.js 验证哈希计算：
```javascript
const crypto = require('crypto');
const text = '检查 items 数组不为空，taxRate 在 0-1 之间';
const normalized = text.trim().replace(/\s+/g, ' ');
const hash = crypto.createHash('md5').update(normalized, 'utf8').digest('hex').substring(0, 8);
console.log(hash);
```

## 已知问题

1. 如果 VSCode 扩展未正确加载历史记录，尝试重启 VSCode
2. 如果增量编译未触发，检查 `.cdd/history` 目录权限
3. 如果生成的代码质量不佳，可能是 LLM 对"保持原实现"的理解有偏差

## 下一步

测试通过后，可以：
1. 更新 package.json 版本号到 0.2.0
2. 更新 README 添加增量编译说明
3. 准备发布新版本
