# CDD Framework

CDD (Comment-Driven Development) Framework 是一个 VSCode 扩展，用于验证和执行 CDD v2.4.1 开发范式。

## 功能特性

- **编译注释为代码**：将 CDD 注释（@contract、@step、@boundary）编译为可执行代码
- **跨文件引用**：自动提取被调用函数的契约，支持 import/include 语句解析和全局搜索
- **审查代码**：验证代码是否符合注释契约
- **转译代码为注释**：将现有代码逆向转译为 CDD 注释
- **分析变更影响**：分析 CHANGELOG 中的变更对其他模块的影响
- **初始化项目结构**：创建 CDD 项目所需的目录和模板文件
- **多语言支持**：支持 14 种编程语言（TypeScript、JavaScript、Python、C++、C、Java、Go、Rust、ArkTS、Kotlin、Swift、C#、Ruby、PHP）
- **多 API 提供商支持**：支持 Anthropic Claude API 和 OpenAI 格式 API（DeepSeek、ModelScope 等）

## 什么是 CDD？

CDD (Comment-Driven Development) 是一种"注释即源码"的开发范式：
- 先用结构化注释定义契约（@contract）、步骤（@step）、边界（@boundary）
- 再通过 AI 编译器将注释编译为代码
- 通过审查员验证代码与注释的一致性
- 实现需求→注释→代码的完整闭环

## 安装

1. 克隆本仓库
2. 运行 `npm install` 安装依赖
3. 按 F5 启动扩展开发主机

## 配置

在 VSCode 设置中配置以下选项：

```json
{
  "cdd.apiKey": "your-api-key-here",
  "cdd.apiBaseUrl": "https://api.anthropic.com",
  "cdd.modelId": "claude-sonnet-4-20250514",
  "cdd.targetLanguage": ""
}
```

**使用 Anthropic Claude API：**

```json
{
  "cdd.apiKey": "sk-ant-xxx",
  "cdd.apiBaseUrl": "https://api.anthropic.com",
  "cdd.modelId": "claude-sonnet-4-20250514"
}
```

**使用 DeepSeek API（推荐）：**

```json
{
  "cdd.apiKey": "sk-xxx",
  "cdd.apiBaseUrl": "https://api.deepseek.com/v1",
  "cdd.modelId": "deepseek-chat"
}
```

**使用 OpenAI API：**

```json
{
  "cdd.apiKey": "sk-xxx",
  "cdd.apiBaseUrl": "https://api.openai.com/v1",
  "cdd.modelId": "gpt-4"
}
```

**使用 ModelScope API：**

```json
{
  "cdd.apiKey": "your-token",
  "cdd.apiBaseUrl": "https://api.modelscope.cn/v1",
  "cdd.modelId": "qwen-plus"
}
```

**配置说明：**
- `apiKey`: Claude API 密钥（必填）
- `apiBaseUrl`: API 端点地址（可选，默认为官方 API）
- `modelId`: 模型 ID（可选，默认为 claude-sonnet-4-20250514）
- `targetLanguage`: 目标编程语言（可选，留空则根据文件扩展名自动检测）

## 使用方法

### 1. 初始化 CDD 项目

- 打开命令面板（Ctrl+Shift+P）
- 运行 `CDD: 初始化项目结构`
- 系统将创建 `_source/` 目录和以下模板文件：
  - PROJECT_SOUL.md
  - BUSINESS_RULES.md
  - TECH_STACK.md
  - CONTRACTS.md
  - COMPILE_SPEC.md
  - CHANGELOG.md
  - WorkSchedule.md

### 2. 编译注释为代码

1. 编写包含 `@contract`、`@step`、`@boundary` 的注释
2. 选中注释文本
3. 右键选择 `CDD: 编译注释为代码`
4. 生成的代码将插入到注释下方
5. 自动触发代码审查

示例注释：

```typescript
// @contract: calculateSum(a: number, b: number) => number
// @step: [验证输入] 检查 a 和 b 是否为有效数字
// @step: [计算] 返回 a + b
// @boundary: 当输入非数字时，抛出 TypeError
```

**跨文件引用功能**：

如果你的代码调用了其他文件中的函数，编译器会自动提取这些函数的契约：

```typescript
import { validateUser } from './userService';

// @contract: processUser(userId: string) => Promise<User>
// @step: [验证] 调用 validateUser 验证用户
// @step: [处理] 处理用户数据
// @step: [返回] 返回用户对象
```

编译器会：
1. 从 import 语句中找到 `./userService.ts`
2. 在该文件中搜索 `validateUser` 的契约
3. 将契约传递给 AI，确保生成的代码正确调用该函数

如果在导入的文件中找不到契约，系统会询问是否在整个工作区搜索，并提供便捷的导入建议。

### 3. 审查代码

1. 选中包含注释和代码的完整函数（从 `@contract` 到 `// @end`）
2. 右键选择 `CDD: 审查代码`
3. 审查报告将追加到 `REVIEW_REPORT.md`

### 4. 转译代码为注释

1. 选中现有代码块
2. 右键选择 `CDD: 转译代码为注释`
3. 生成的注释将插入到代码上方

### 5. 分析变更影响

- 打开命令面板
- 运行 `CDD: 分析变更影响`
- 系统将分析 CHANGELOG.md 中的最新变更，并生成影响分析报告

## CDD 注释规范

### @contract

定义函数契约，包括函数签名和异常类型：

```typescript
// @contract: functionName(param1: Type1, param2: Type2) => ReturnType throws ExceptionType
```

### @step

定义执行步骤，格式为 `[步骤名] 步骤描述`：

```typescript
// @step: [验证输入] 检查参数是否有效
// @step: [处理数据] 执行核心业务逻辑
// @step: [返回结果] 返回处理后的数据
```

### @boundary

定义边界条件和异常处理：

```typescript
// @boundary: 当参数为空时，抛出 ValidationError
// @boundary: 当网络请求失败时，重试一次
```

### @end

标记函数结束：

```typescript
// @end
```

## 项目结构

```
project/
├── _source/              # CDD 规范文档
│   ├── PROJECT_SOUL.md   # 项目愿景
│   ├── BUSINESS_RULES.md # 业务规则
│   ├── TECH_STACK.md     # 技术栈
│   ├── CONTRACTS.md      # 模块契约
│   ├── COMPILE_SPEC.md   # 编译规范
│   └── CHANGELOG.md      # 变更日志
├── WorkSchedule.md       # 工作日志
├── REVIEW_REPORT.md      # 审查报告
└── src/                  # 源代码
```

## 开发

### 编译

```bash
npm run compile
```

### 监听模式

```bash
npm run watch
```

### 调试

按 F5 启动扩展开发主机，在新窗口中测试扩展功能。

## 支持的编程语言

CDD Framework 支持以下 14 种编程语言：

| 语言 | 文件扩展名 |
|------|-----------|
| TypeScript | .ts |
| JavaScript | .js, .mjs, .cjs |
| Python | .py |
| C++ | .cpp, .cc, .cxx |
| C | .c, .h |
| Java | .java |
| Go | .go |
| Rust | .rs |
| ArkTS | .ets |
| Kotlin | .kt, .kts |
| Swift | .swift |
| C# | .cs |
| Ruby | .rb |
| PHP | .php |

语言检测优先级：配置项 `cdd.targetLanguage` > 文件扩展名 > 默认 TypeScript

## 技术栈

- TypeScript 5.x
- VSCode Extension API
- Claude API (支持自定义端点和模型)
- MVVM 架构

## 许可证

MIT
