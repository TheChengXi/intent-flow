# COMPILE_SPEC.md

## 编译规范

本文档定义编译器生成代码时必须遵循的精确规则。

---

## 一、命名规范

### 1.1 TypeScript 命名约定
- **类名：** PascalCase（如 `CompilerVM`, `CDDComment`）
- **接口名：** PascalCase，不加 `I` 前缀（如 `RoleResult`, `CommandContext`）
- **函数/方法名：** camelCase（如 `parseComment`, `executeCommand`）
- **变量名：** camelCase（如 `commentText`, `apiResponse`）
- **常量名：** UPPER_SNAKE_CASE（如 `MAX_RETRY_COUNT`, `API_TIMEOUT`）
- **私有成员：** 以 `_` 开头（如 `_apiKey`, `_internalState`）
- **类型参数：** 单个大写字母或 PascalCase（如 `T`, `TResult`）

### 1.2 文件命名
- **类文件：** PascalCase.ts（如 `CompilerVM.ts`）
- **工具函数文件：** camelCase.ts（如 `parseComment.ts`）
- **常量文件：** camelCase.ts（如 `errorTypes.ts`）

### 1.3 禁止使用的名称
- 单字母变量（除循环索引 `i`, `j`, `k`）
- 缩写（除公认缩写如 `API`, `URL`, `ID`）
- 拼音命名
- 无意义名称（如 `temp`, `data`, `obj`）

---

## 二、格式规范

### 2.1 缩进与空格
- **缩进：** 2 空格（不使用 Tab）
- **行尾：** 无空格
- **文件末尾：** 单个空行

### 2.2 代码块
```typescript
// ✅ 正确：大括号不换行
if (condition) {
  doSomething();
}

// ❌ 错误：大括号换行
if (condition)
{
  doSomething();
}
```

### 2.3 函数声明
```typescript
// ✅ 正确：参数过多时换行对齐
function longFunctionName(
  param1: string,
  param2: number,
  param3: boolean
): ReturnType {
  // ...
}

// ✅ 正确：箭头函数
const shortFunc = (param: string): number => {
  return param.length;
};
```

### 2.4 导入语句
```typescript
// ✅ 正确：按类型分组，组间空行
import * as vscode from 'vscode';
import * as fs from 'fs/promises';

import { CDDComment } from '../model/entities/CDDComment';
import { FileRepository } from '../model/repositories/FileRepository';

import { parseComment } from '../utils/parseComment';
```

### 2.5 空行规则
- 类成员之间：1 个空行
- 逻辑块之间：1 个空行
- 函数之间：2 个空行（类内部除外）

---

## 三、TypeScript 特定规则

### 3.1 类型注解
```typescript
// ✅ 正确：显式类型注解
function processComment(comment: CDDComment): string {
  const result: string = comment.contract.functionName;
  return result;
}

// ❌ 错误：省略类型（除非类型推断明确）
function processComment(comment) {
  const result = comment.contract.functionName;
  return result;
}
```

### 3.2 接口 vs 类型别名
- **接口：** 用于对象形状定义（可扩展）
- **类型别名：** 用于联合类型、交叉类型、工具类型

```typescript
// ✅ 正确：接口定义对象
interface CDDComment {
  contract: ContractAnnotation;
  steps: StepAnnotation[];
}

// ✅ 正确：类型别名定义联合类型
type ReviewConclusion = 'PASS' | 'MINOR_DEVIATION' | 'MAJOR_VIOLATION';
```

### 3.3 可选属性与 undefined
```typescript
// ✅ 正确：使用可选属性
interface Config {
  apiKey?: string;
}

// ❌ 错误：显式 undefined
interface Config {
  apiKey: string | undefined;
}
```

### 3.4 异步函数
```typescript
// ✅ 正确：async/await
async function readFile(path: string): Promise<string> {
  try {
    const content = await fs.readFile(path, 'utf-8');
    return content;
  } catch (error) {
    throw new FileNotFoundError(`File not found: ${path}`);
  }
}

// ❌ 错误：Promise 链
function readFile(path: string): Promise<string> {
  return fs.readFile(path, 'utf-8')
    .then(content => content)
    .catch(error => {
      throw new FileNotFoundError(`File not found: ${path}`);
    });
}
```

### 3.5 严格模式要求
- 启用 `strict: true`
- 禁止 `any` 类型（除非显式标注 `// eslint-disable-next-line @typescript-eslint/no-explicit-any`）
- 禁止 `!` 非空断言（除非已验证）

---

## 四、VSCode Extension 平台规则

### 4.1 异步操作
```typescript
// ✅ 正确：使用 vscode.window.withProgress
async function compileComment(comment: CDDComment): Promise<string> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: '正在编译注释...',
      cancellable: false
    },
    async (progress) => {
      progress.report({ increment: 0 });
      const result = await apiService.callAPI(request);
      progress.report({ increment: 100 });
      return result.content;
    }
  );
}

// ❌ 错误：阻塞主线程
function compileComment(comment: CDDComment): string {
  const result = apiService.callAPISync(request); // 不存在同步 API
  return result.content;
}
```

### 4.2 错误处理
```typescript
// ✅ 正确：用户友好的错误提示
try {
  await compileComment(comment);
} catch (error) {
  if (error instanceof APIError) {
    vscode.window.showErrorMessage(
      `编译失败：${error.message}。请检查 API Key 配置。`
    );
  } else {
    vscode.window.showErrorMessage(`未知错误：${error}`);
  }
}

// ❌ 错误：静默失败
try {
  await compileComment(comment);
} catch (error) {
  console.error(error); // 用户看不到
}
```

### 4.3 资源清理
```typescript
// ✅ 正确：注册 Disposable
export function activate(context: vscode.ExtensionContext) {
  const command = vscode.commands.registerCommand('cdd.compile', handler);
  context.subscriptions.push(command); // 自动清理
}

// ❌ 错误：未注册
export function activate(context: vscode.ExtensionContext) {
  vscode.commands.registerCommand('cdd.compile', handler); // 内存泄漏
}
```

### 4.4 配置读取
```typescript
// ✅ 正确：使用 workspace.getConfiguration
const config = vscode.workspace.getConfiguration('cdd');
const timeout = config.get<number>('apiTimeout', 30000);

// ❌ 错误：硬编码
const timeout = 30000;
```

---

## 五、AI 常见错误防御

### 5.1 空值检查
```typescript
// ✅ 正确：显式检查
function processEditor(editor: vscode.TextEditor | undefined): void {
  if (!editor) {
    vscode.window.showErrorMessage('未打开编辑器');
    return;
  }
  // 使用 editor
}

// ❌ 错误：假设非空
function processEditor(editor: vscode.TextEditor | undefined): void {
  const text = editor.document.getText(); // 可能崩溃
}
```

### 5.2 数组操作
```typescript
// ✅ 正确：检查数组长度
function getFirstStep(steps: StepAnnotation[]): StepAnnotation | null {
  return steps.length > 0 ? steps[0] : null;
}

// ❌ 错误：假设非空
function getFirstStep(steps: StepAnnotation[]): StepAnnotation {
  return steps[0]; // 可能 undefined
}
```

### 5.3 正则表达式
```typescript
// ✅ 正确：检查匹配结果
const match = text.match(/@contract:\s*(\w+)/);
if (match && match[1]) {
  const functionName = match[1];
}

// ❌ 错误：假设匹配成功
const match = text.match(/@contract:\s*(\w+)/);
const functionName = match[1]; // 可能崩溃
```

### 5.4 文件路径
```typescript
// ✅ 正确：使用 path 模块
import * as path from 'path';
const fullPath = path.join(workspaceRoot, '_source', 'CONTRACTS.md');

// ❌ 错误：字符串拼接
const fullPath = workspaceRoot + '/_source/CONTRACTS.md'; // Windows 路径错误
```

### 5.5 异常类型
```typescript
// ✅ 正确：检查异常类型
try {
  await operation();
} catch (error) {
  if (error instanceof ValidationError) {
    // 处理验证错误
  } else if (error instanceof Error) {
    // 处理通用错误
  } else {
    // 处理未知错误
    throw new Error(`Unknown error: ${error}`);
  }
}

// ❌ 错误：假设 error 是 Error
try {
  await operation();
} catch (error) {
  console.error(error.message); // error 可能不是 Error 对象
}
```

---

## 六、注释规范

### 6.1 CDD 注释
```typescript
// @contract: parseComment(text: string) => CDDComment | null
// @step: [解析] 使用正则提取 @contract、@step、@boundary
// @step: [验证] 检查格式是否符合 BR-007
// @step: [构建] 构建 CDDComment 对象
// @boundary: 当未找到 @contract 时，返回 null
// @boundary: 当格式不符合时，抛出 ValidationError
export function parseComment(text: string): CDDComment | null {
  // 实现代码
}
// @end
```

### 6.2 行内注释
```typescript
// ✅ 正确：解释"为什么"
const timeout = 30000; // Claude API 平均响应时间 10-20s，留 50% 余量

// ❌ 错误：重复代码
const timeout = 30000; // 设置超时为 30000
```

### 6.3 TODO 注释
```typescript
// TODO(username): 需要添加重试逻辑
// FIXME: 当文件超过 1MB 时性能下降
// HACK: 临时方案，等待 VSCode API 支持
```

---

## 七、性能规范

### 7.1 避免阻塞
- 文件读写必须使用 `fs/promises`
- API 调用必须异步
- 大文件处理使用流式读取

### 7.2 缓存策略
```typescript
// ✅ 正确：缓存编译规范
class CompilerVM {
  private _cachedSpec: string | null = null;

  async getCompileSpec(): Promise<string> {
    if (this._cachedSpec) {
      return this._cachedSpec;
    }
    this._cachedSpec = await fileRepo.readFile('_source/COMPILE_SPEC.md');
    return this._cachedSpec;
  }
}
```

### 7.3 内存管理
- 及时释放大对象
- 避免全局变量
- 使用 WeakMap 存储临时关联

---

## 八、安全规范

### 8.1 API Key 存储
```typescript
// ✅ 正确：使用 SecretStorage
async function getAPIKey(context: vscode.ExtensionContext): Promise<string> {
  const key = await context.secrets.get('cdd.apiKey');
  if (!key) {
    throw new ConfigurationError('API Key 未配置');
  }
  return key;
}

// ❌ 错误：明文存储
const apiKey = vscode.workspace.getConfiguration('cdd').get('apiKey');
```

### 8.2 输入验证
```typescript
// ✅ 正确：验证用户输入
function validateFunctionName(name: string): void {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new ValidationError('函数名格式不正确');
  }
}
```

### 8.3 路径遍历防御
```typescript
// ✅ 正确：限制路径范围
function resolvePath(relativePath: string, workspaceRoot: string): string {
  const fullPath = path.resolve(workspaceRoot, relativePath);
  if (!fullPath.startsWith(workspaceRoot)) {
    throw new SecurityError('路径遍历攻击');
  }
  return fullPath;
}
```

---

## 九、测试规范

### 9.1 单元测试
- 每个公共函数必须有对应测试
- 测试文件命名：`*.test.ts`
- 使用 Mocha + Chai

### 9.2 测试覆盖率
- 语句覆盖率 > 80%
- 分支覆盖率 > 70%
- 关键路径覆盖率 100%

---

**版本：** 1.0.0  
**创建日期：** 2026-05-09  
**最后更新：** 2026-05-09
