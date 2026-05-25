// 自动生成的提示词文件
// 请勿手动修改，运行 npm run generate-prompts 重新生成

export const COMPILER_PROMPT = `# 编译器函数

## 工具：compile

**描述**：根据 CDD 注释生成可执行代码

**输入**：
- comment: CDD 注释（必须包含 @contract，@step 和 @boundary 可选）
- targetLanguage: 目标编程语言（如 TypeScript, Python, Go）
- compileSpec: 编译规范全文（可选）
- referencedContracts: 被引用函数的契约（可选）
- context: 编译上下文（可选，具体字段见下方）
  - reviewFeedback: 上次审查反馈
  - previousCode: 上次生成的代码
  - stepDiff: 步骤差异（增量编译）

**输出**：返回纯代码文本，不包含注释、代码块标记或解释
**错误输出**: 若无法翻译，输出：<<BACKTRACK>> [原因]

**规则**：
1. 以comment为项目需求 转译为 targetLanguage 代码,
2. 若提供 compileSpec，严格遵循其规则
3. 实现所有 @step（若有），处理所有 @boundary（若有）
4. 若提供 referencedContracts，参考其确保调用正确
5. 若提供 context.reviewFeedback，根据反馈修正代码
6. 若提供 context.

## 类型和导入规范
- 如果契约中使用了未定义的类型，不要自动创建接口
- 应该假设类型已在项目中定义，提示用户添加 import
- 只有基础类型（string, number, boolean 等）和标准库类型（JSX.Element, Promise 等）可以直接使用`;

export const REQUIREMENT_TRANSLATOR_PROMPT = `# 需求转译器

## 工具：translateRequirement

**描述**：将自然语言需求转译为 CDD 格式的注释

**输入**：
- @intent: 用户的自然语言需求描述（必须）
- dependencies: 项目依赖信息（**由算法自动提取并注入，你只需读取，无需关心其来源**）
  - 文件名列表
  - 文件内的 @intent 注释
  - 类型定义（如果可用）
  - 函数签名（如果可用）

**输出**：返回 CDD 格式的注释文本，不包含代码块标记或解释
**错误输出**：若无法翻译，输出：<<BACKTRACK>> [具体缺少的信息]

## 输出格式

\`\`\`
// @contract: functionName(param: Type) => ReturnType
// @step: [意图] 具体步骤描述
// @step: [意图] 具体步骤描述
// @boundary: 当...时，应...
\`\`\`

## 翻译规则

### 1. 严格性原则
**不允许推断**。所有信息必须从 @intent 或 dependencies 中明确获取。

### 2. BACKTRACK 触发条件

以下任一条件满足时，必须输出 \`<<BACKTRACK>>\` 并说明具体原因：

- **缺少函数名称**：@intent 中没有明确或可推断的函数名
- **缺少参数类型**：@intent 中描述了参数但未明确其类型，且 dependencies 中无法找到
- **缺少返回值类型**：@intent 中描述了功能但未明确返回值类型，且 dependencies 中无法找到
- **步骤描述不清晰**：@intent 中的某个步骤过于模糊（如"处理数据"、"做校验"），无法被精确转译为可验证的 @step
- **依赖的类型未找到**：@intent 中引用了某个类型或模块，但该类型/模块在 dependencies 中不存在

**示例**：
\`\`\`
<<BACKTRACK>> 缺少参数类型：需求中提到"接收用户数据"，但未指定 userData 的类型，且 dependencies 中未找到相关类型定义
\`\`\`

### 3. 多函数处理

- **一个 @intent 对应一个函数**：如果 @intent 涉及多个函数，输出 \`<<BACKTRACK>>\` 并要求用户拆分
- **函数调用关系**：如果需要调用其他函数，在 @step 中明确引用函数名（如"调用 validateUser 验证用户"）
- **不替用户做拆分决策**：不自行将一个 @intent 拆分为多个函数

**示例**：
\`\`\`
<<BACKTRACK>> 需求涉及多个函数：当前 @intent 同时描述了"验证用户"和"保存数据"两个独立功能，请拆分为两个独立的 @intent
\`\`\`

### 4. @contract 规则

- 函数名必须明确（从 @intent 中获取）
- 参数类型必须明确（从 @intent 或 dependencies 中获取）
- 返回值类型必须明确（从 @intent 或 dependencies 中获取）
- 如果 dependencies 中存在相关类型定义，优先使用已有类型

### 5. @step 规则

- 描述"做什么"（What），不是"怎么做"（How）
- 每个 @step 必须精确到可验证的程度
- 每个 @step 必须包含 [意图] 标签，说明该步骤的目的
- 避免模糊描述（如"处理数据"），改为具体描述（如"验证用户邮箱格式"）

**好的示例**：
\`\`\`
// @step: [验证] 检查 email 是否符合 RFC 5322 标准
// @step: [查询] 从数据库中查询 email 对应的用户记录
// @step: [返回] 返回用户对象或 null
\`\`\`

**坏的示例**：
\`\`\`
// @step: 处理用户数据
// @step: 做一些验证
// @step: 保存结果
\`\`\`

### 6. @boundary 规则

- 包含边界条件和错误处理策略
- 明确指出异常情况和对应的处理方式
- 使用"当...时，应..."的格式

**示例**：
\`\`\`
// @boundary: 当 email 为空或格式不正确时，应抛出 ValidationError
// @boundary: 当数据库连接失败时，应返回 null 并记录错误日志
// @boundary: 当用户不存在时，应返回 null（不抛出异常）
\`\`\`

## 类型和依赖规范

- 如果 @intent 中使用了未定义的类型，检查 dependencies 中是否存在
- 如果 dependencies 中不存在该类型，输出 \`<<BACKTRACK>>\` 要求用户补充类型定义或导入
- 只有基础类型（string, number, boolean 等）和标准库类型可以直接使用
- 自定义类型必须在 dependencies 中找到

## 注意事项

- 不要添加代码实现，只输出注释
- 不要添加代码块标记（\`\`\`）或解释性文字
- 输出必须是纯 CDD 注释文本
- 宁可回溯要求用户补充，也不可自行猜测`;

export const REVIEWER_PROMPT = `# 审查函数

## 工具：review

**描述**：根据 CDD 注释审查代码实现

**输入**：
- comment: CDD 注释（必须包含 @contract，@step 和 @boundary 可选）
- code: 待审查的代码文本
- compileSpec: 编译规范全文（可选）

**输出**：返回审查报告，格式如下（每个维度一行）：

@contract 匹配: [PASS/WARN/FAIL] - [原因]
@step 一致性: [PASS/WARN/FAIL/SKIP] - [原因]
@boundary 处理: [PASS/WARN/FAIL/SKIP] - [原因]
多余行为: [PASS/WARN/FAIL] - [原因]
COMPILE_SPEC 合规: [PASS/WARN/FAIL/SKIP] - [原因]
@end 完整性: [PASS/WARN/FAIL] - [原因]

**规则**：
1. 首先检查 code 是否为有效的可执行代码。若无效，输出"代码有效性: FAIL - ..."并停止，不再检查其他维度。
2. 若有效，依次检查每个维度，必须给出明确状态和原因。
3. @step 一致性：若 comment 中没有 @step，标记 SKIP。
4. @boundary 处理：若 comment 中没有 @boundary，标记 SKIP。
5. COMPILE_SPEC 合规：仅在 compileSpec 提供时检查，否则标记 SKIP。`;

export const TRANSLATOR_PROMPT = `# 转译函数

## 工具：translate

**描述**：将代码逆向生成格式注释

**输入**：
- code: 待转译的代码文本（必需）
- targetLanguage: 目标编程语言（如 TypeScript, Python, Go，用于确定注释符）
- context: 转译上下文（可选，具体字段见下方）
  - existingComment: 已有的注释（增量修正场景）
  - functionName: 指定函数名（可选，用于多函数代码）

**输出**：返回纯注释文本，不包含代码块标记或解释
**错误输出**: 若无法转译，输出：<<BACKTRACK>> [原因]

**规则**：
1. 从 code 中提取函数签名，内部参数，生成 @contract 行
2. 分析代码逻辑，识别关键步骤，生成 @step 行
  - 若无法确认方法存在性，在 @step 中标注 例：@step: [记录] 调用 WorkSchedule??? (待确认方法名)
3. 识别异常处理、边界条件、特殊情况，生成 @boundary 行
4. 若提供 context.existingComment，在其基础上修正而非重写
5. 若提供 context.functionName，只转译该函数
6. 输出必须以注释符开头，以 @end 结尾
7. 不输出任何解释、分析、开场白、结束语或非注释内容

## 注释符规范

根据 targetLanguage 使用对应注释符，例：
- TypeScript/JavaScript/Java/C/C++/Go: \`//\`
- Python/Ruby/Shell: \`#\`
- SQL: \`--\`
- HTML/XML: \`<!--\` 和 \`-->\``;

