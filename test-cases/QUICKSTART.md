# CDD Framework 快速开始

## 1. 启动扩展

1. 在 VSCode 中打开本项目
2. 按 `F5` 启动扩展开发主机
3. 新窗口将打开，扩展已加载

## 2. 配置 API

在新窗口中：
1. 打开设置（Ctrl+,）
2. 搜索 "cdd"
3. 配置以下选项

或直接编辑 `settings.json`：
```json
{
  "cdd.apiKey": "your-api-key",
  "cdd.apiBaseUrl": "https://api.anthropic.com",
  "cdd.modelId": "claude-sonnet-4-20250514",
  "cdd.targetLanguage": ""
}
```

**中转 API 配置示例：**
```json
{
  "cdd.apiKey": "sk-xxx",
  "cdd.apiBaseUrl": "https://your-proxy.com",
  "cdd.modelId": "claude-haiku-4-5-20251001"
}
```

## 3. 初始化测试项目

1. 创建一个新文件夹作为测试项目
2. 在新窗口中打开该文件夹
3. 打开命令面板（Ctrl+Shift+P）
4. 运行 `CDD: 初始化项目结构`
5. 系统将创建 `_source/` 目录和模板文件

## 4. 测试编译功能

创建测试文件 `test.ts`：

```typescript
// @contract: add(a: number, b: number) => number
// @step: [验证] 检查 a 和 b 是否为数字
// @step: [计算] 返回 a + b 的和
// @boundary: 当参数不是数字时，抛出 TypeError
```

1. 选中上述注释
2. 右键选择 `CDD: 编译注释为代码`
3. 等待 API 响应
4. 代码将自动插入到注释下方
5. 自动触发审查流程

## 5. 测试审查功能

选中完整的函数（包括注释和生成的代码），右键选择 `CDD: 审查代码`。

审查报告将保存到 `REVIEW_REPORT.md`。

## 6. 测试转译功能

编写一段现有代码：

```typescript
function multiply(x: number, y: number): number {
  if (typeof x !== 'number' || typeof y !== 'number') {
    throw new TypeError('参数必须是数字');
  }
  return x * y;
}
```

1. 选中代码
2. 右键选择 `CDD: 转译代码为注释`
3. CDD 注释将插入到代码上方

## 7. 测试分析功能

1. 手动编辑 `_source/CHANGELOG.md`，添加一条变更记录：
```
2026-05-09 | test.ts | 新增 add 函数 | 实现基础加法功能 | 新增
```

2. 运行 `CDD: 分析变更影响`
3. 查看生成的影响分析报告

## 常见问题

### 扩展未激活
- 确保按 F5 启动了扩展开发主机
- 检查调试控制台是否有错误信息

### API 调用失败
- 检查 API Key 是否正确配置
- 确认网络连接正常
- 查看 Claude API 配额是否充足

### 编译失败
- 确保注释格式正确（@contract、@step、@boundary）
- 检查 `_source/COMPILE_SPEC.md` 是否存在
- 查看错误提示信息

### 审查失败
- 确保选中了完整的代码块（从 @contract 到 // @end）
- 检查代码是否包含 `// @end` 标记

## 调试技巧

1. 打开调试控制台查看日志：`帮助 > 切换开发人员工具`
2. 在源代码中设置断点进行调试
3. 查看 `WorkSchedule.md` 了解操作历史
4. 查看 `REVIEW_REPORT.md` 了解审查结果

## 8. 多语言支持

CDD Framework 支持 14 种编程语言的代码生成：

- TypeScript (.ts)
- JavaScript (.js, .mjs, .cjs)
- Python (.py)
- C++ (.cpp, .cc, .cxx)
- C (.c, .h)
- Java (.java)
- Go (.go)
- Rust (.rs)
- ArkTS (.ets)
- Kotlin (.kt, .kts)
- Swift (.swift)
- C# (.cs)
- Ruby (.rb)
- PHP (.php)

**语言检测规则：**
1. 优先使用配置项 `cdd.targetLanguage`（如果设置）
2. 否则根据文件扩展名自动检测
3. 默认为 TypeScript

**配置示例：**
```json
{
  "cdd.targetLanguage": "Python"
}
```

## 9. 测试用例

项目包含 6 个测试用例，位于 `test-cases/` 目录：

1. **test-simple.ts** - 基本函数测试
2. **test-exception.ts** - 异常处理测试
3. **test-array.ts** - 数组处理测试
4. **test-async.ts** - 异步函数测试
5. **test-python.py** - Python 多语言测试
6. **test-complex.ts** - 复杂逻辑测试（测试 NEEDS_SPLIT 提示）

详细说明请参考 `test-cases/README.md`。

## 下一步

- 填写 `_source/PROJECT_SOUL.md` 定义项目愿景
- 完善 `_source/BUSINESS_RULES.md` 业务规则
- 在 `_source/COMPILE_SPEC.md` 中添加项目特定的编译规范
- 使用 CDD 范式开发实际项目
