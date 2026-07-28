# 转译函数

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
- TypeScript/JavaScript/Java/C/C++/Go: `//`
- Python/Ruby/Shell: `#`
- SQL: `--`
- HTML/XML: `<!--` 和 `-->`