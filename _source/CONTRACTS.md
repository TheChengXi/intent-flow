# CONTRACTS.md

## 模块契约定义

---

## Model 层契约

### CDDComment 实体
```typescript
// @contract: CDDComment
// 表示一个完整的 CDD 注释块（@contract + @step + @boundary）
interface CDDComment {
  contract: ContractAnnotation;
  steps: StepAnnotation[];
  boundaries: BoundaryAnnotation[];
  range: vscode.Range;
}
```

### CommentParser
```typescript
// @contract: parseComment(text: string, document: vscode.TextDocument) => CDDComment | null
// @step: [解析] 使用正则表达式提取 @contract、@step、@boundary
// @step: [验证] 检查 @contract 格式是否符合 BR-007
// @step: [构建] 构建 CDDComment 对象，记录在文档中的 Range
// @boundary: 当未找到 @contract 时，返回 null
// @boundary: 当格式不符合 BR-007 时，抛出 ValidationError
```

### FileRepository
```typescript
// @contract: readFile(filePath: string) => Promise<string>
// @step: [读取] 使用 fs.promises.readFile 读取文件内容
// @step: [解码] 以 UTF-8 解码
// @boundary: 当文件不存在时，抛出 FileNotFoundError
// @boundary: 当无读取权限时，抛出 PermissionError

// @contract: writeFile(filePath: string, content: string) => Promise<void>
// @step: [创建目录] 如果父目录不存在，递归创建
// @step: [写入] 使用 fs.promises.writeFile 写入内容
// @boundary: 当无写入权限时，抛出 PermissionError

// @contract: appendFile(filePath: string, content: string) => Promise<void>
// @step: [追加] 使用 fs.promises.appendFile 追加内容
// @boundary: 当文件不存在时，自动创建
```

### WorkScheduleRepo
```typescript
// @contract: addRecord(record: CompileRecord) => Promise<void>
// @step: [格式化] 按 BR-004 格式化记录：日期 | 时间 | 角色 | 简述 | 耗时 | 依赖
// @step: [追加] 调用 FileRepository.appendFile 追加到 WorkSchedule.md
// @step: [检查行数] 读取文件行数，超过 500 行触发归档
// @boundary: 当 WorkSchedule.md 不存在时，自动创建并添加表头

// @contract: archiveOldRecords() => Promise<void>
// @step: [读取] 读取 WorkSchedule.md 全部内容
// @step: [分割] 保留最近 100 行，其余移动到 WorkSchedule_v[N].md
// @step: [写入] 更新 WorkSchedule.md，创建归档文件
// @boundary: 当已存在同名归档文件时，递增版本号
```

### ChangelogRepo
```typescript
// @contract: addEntry(entry: ChangelogEntry) => Promise<void>
// @step: [格式化] 按 BR-005 格式化：日期 | 文件 | 变更内容 | 原因 | 类型
// @step: [追加] 调用 FileRepository.appendFile 追加到 _source/CHANGELOG.md
// @boundary: 当 CHANGELOG.md 不存在时，自动创建并添加表头

// @contract: getLatestEntry() => Promise<ChangelogEntry | null>
// @step: [读取] 读取 _source/CHANGELOG.md 最后一行
// @step: [解析] 按 BR-005 格式解析
// @boundary: 当文件为空或不存在时，返回 null
```

### ClaudeAPIService
```typescript
// @contract: callAPI(request: ClaudeAPIRequest) => Promise<ClaudeAPIResponse>
// @step: [构建请求] 根据 role 构建不同的 system prompt
// @step: [调用] 使用 Anthropic SDK 调用 claude-4.6-sonnet-medium
// @step: [重试] 失败后等待 2 秒重试 1 次（BR-006）
// @step: [解析响应] 提取 content 和 usage
// @boundary: 当 API Key 未配置时，抛出 ConfigurationError
// @boundary: 当重试后仍失败时，抛出 APIError 包含原始错误信息
// @boundary: 当响应超时（30s）时，抛出 TimeoutError

// @contract: getAPIKey() => Promise<string>
// @step: [读取] 从 VSCode SecretStorage 读取 API Key
// @boundary: 当未配置时，提示用户输入并保存
```

### DependencyTracker
```typescript
// @contract: recordDependency(functionName: string, dependencies: ContractDependency[]) => void
// @step: [存储] 将依赖关系存储在内存 Map 中
// @step: [版本] 记录每个依赖契约的当前版本

// @contract: checkOutdated(changedContracts: string[]) => string[]
// @step: [扫描] 遍历 WorkSchedule.md 中的所有编译记录
// @step: [比对] 检查依赖的契约版本是否在 changedContracts 中
// @step: [返回] 返回受影响的函数名列表
// @boundary: 当 WorkSchedule.md 不存在时，返回空数组
```

---

## ViewModel 层契约

### BaseRole（抽象基类）
```typescript
// @contract: execute(context: CommandContext) => Promise<RoleResult>
// @step: [抽象方法] 子类必须实现具体执行逻辑
// @boundary: 当执行失败时，返回 success: false 和错误信息

// @contract: getNextRole() => string | null
// @step: [返回] 返回建议的下一个角色名称
// @boundary: 当无下一步时，返回 null
```

### CompilerVM
```typescript
// @contract: compile(comment: CDDComment, compileSpec: string) => Promise<string>
// @step: [估算] 根据 @step 数量估算代码行数
// @step: [暂停检查] 预计超过 200 行时，返回特殊标记 NEEDS_SPLIT（BR-003）
// @step: [构建 Prompt] 将注释 + compileSpec 构建为 API 请求
// @step: [调用 API] 通过 ClaudeAPIService 生成代码
// @step: [添加标记] 在代码末尾添加 // @end
// @step: [记录依赖] 提取代码中引用的函数，调用 DependencyTracker.recordDependency
// @boundary: 当注释格式不符合 BR-007 时，抛出 ValidationError
// @boundary: 当 API 调用失败时，抛出 APIError
```

### ReviewerVM
```typescript
// @contract: review(comment: CDDComment, code: string, compileSpec: string) => Promise<ReviewReport>
// @step: [构建 Prompt] 将注释 + 代码 + 审查维度（BR-001）构建为 API 请求
// @step: [调用 API] 通过 ClaudeAPIService 执行审查
// @step: [解析结果] 解析 API 返回的审查报告，提取不一致项
// @step: [判断结论] 根据 BR-002 判断 PASS/MINOR_DEVIATION/MAJOR_VIOLATION
// @boundary: 当代码块不完整（缺少 @contract 或 // @end）时，抛出 ValidationError
// @boundary: 当发现严重违规时，返回结论 MAJOR_VIOLATION 并附带裁决选项

// @contract: triggerArbitration(inconsistencies: Inconsistency[]) => Promise<ArbitrationChoice>
// @step: [输出选项] 按 BR-008 格式输出路径A和路径B
// @step: [等待用户] 通过 VSCode QuickPick 等待用户选择
// @boundary: 当用户取消时，抛出 UserCancelledError
```

### TranslatorVM
```typescript
// @contract: translateToComment(code: string) => Promise<CDDComment>
// @step: [构建 Prompt] 要求 API 逆向生成 @contract、@step、@boundary
// @step: [调用 API] 通过 ClaudeAPIService 生成注释
// @step: [解析] 解析 API 返回的注释文本为 CDDComment 对象
// @boundary: 当 API 返回"代码逻辑混乱"时，抛出 LogicUnclearError
// @boundary: 当 API 调用失败时，抛出 APIError
```

### CodeTranslatorVM
```typescript
// @contract: syncCommentFromCode(code: string, oldComment: CDDComment) => Promise<CDDComment>
// @step: [对比] 比较代码与旧注释的差异
// @step: [调用 API] 要求 API 更新注释以匹配代码
// @step: [冲突检测] 检查是否违背旧 @contract
// @boundary: 当检测到契约冲突时，输出《契约冲突请裁决》并暂停
```

### PlannerVM
```typescript
// @contract: analyzeImpact() => Promise<ImpactReport>
// @step: [读取变更] 调用 ChangelogRepo.getLatestEntry
// @step: [扫描依赖] 调用 DependencyTracker.checkOutdated
// @step: [检测类型] 检查是否包含 [PARADIGM SHIFT]
// @step: [生成报告] 输出受影响函数列表和建议
// @boundary: 当 CHANGELOG.md 为空时，返回"无变更"报告
// @boundary: 当检测到 [PARADIGM SHIFT] 时，建议召集 Council
```

---

## Command 层契约

### CompileCommand
```typescript
// @contract: execute() => Promise<void>
// @step: [获取选区] 获取当前编辑器选中的文本范围
// @step: [解析注释] 调用 CommentParser.parseComment
// @step: [读取规范] 读取 _source/COMPILE_SPEC.md（如存在）
// @step: [编译] 调用 CompilerVM.compile
// @step: [插入代码] 在注释下方插入生成的代码
// @step: [记录日志] 调用 WorkScheduleRepo.addRecord
// @step: [触发审查] 自动调用 ReviewCommand.execute
// @boundary: 当未选中文本时，提示"请选中包含 @contract 的函数"
// @boundary: 当未找到 @contract 时，按 BUSINESS_RULES 流程1异常处理
// @boundary: 当编译器返回 NEEDS_SPLIT 时，弹出确认对话框
```

### ReviewCommand
```typescript
// @contract: execute() => Promise<void>
// @step: [获取选区] 获取当前编辑器选中的文本范围
// @step: [解析注释] 调用 CommentParser.parseComment
// @step: [提取代码] 提取 @contract 到 // @end 之间的代码
// @step: [读取规范] 读取 _source/COMPILE_SPEC.md（如存在）
// @step: [审查] 调用 ReviewerVM.review
// @step: [写入报告] 调用 FileRepository.appendFile 追加到 REVIEW_REPORT.md
// @step: [高亮标记] 调用 HighlightDecorator 标记不一致的行
// @step: [记录日志] 调用 WorkScheduleRepo.addRecord
// @boundary: 当代码块不完整时，按 BUSINESS_RULES 流程2异常处理
// @boundary: 当审查结论为 MAJOR_VIOLATION 时，调用 ReviewerVM.triggerArbitration
```

### TranslateCommand
```typescript
// @contract: execute() => Promise<void>
// @step: [获取选区] 获取当前编辑器选中的代码
// @step: [转译] 调用 TranslatorVM.translateToComment
// @step: [插入注释] 在代码上方插入生成的注释
// @step: [记录日志] 调用 WorkScheduleRepo.addRecord
// @step: [提示] 显示"注释已生成，请人工审查后再编译"
// @boundary: 当未选中文本时，提示"请选中要转译的代码块"
// @boundary: 当 API 返回 LogicUnclearError 时，按 BUSINESS_RULES 流程3异常处理
```

### AnalyzeCommand
```typescript
// @contract: execute() => Promise<void>
// @step: [分析] 调用 PlannerVM.analyzeImpact
// @step: [显示报告] 在 OutputPanel 显示影响分析报告
// @step: [记录日志] 调用 WorkScheduleRepo.addRecord
// @boundary: 当 CHANGELOG.md 不存在时，按 BUSINESS_RULES 流程4异常处理
```

### InitCommand
```typescript
// @contract: execute() => Promise<void>
// @step: [检查] 检查 _source/ 是否已存在
// @step: [创建目录] 创建 _source/ 目录
// @step: [复制模板] 从 templates/ 复制所有 .template.md 文件到 _source/
// @step: [创建日志] 创建空的 WorkSchedule.md
// @step: [提示] 显示"CDD 项目结构已创建，请填写 PROJECT_SOUL.md"
// @boundary: 当 _source/ 已存在时，按 BUSINESS_RULES 流程5异常处理
```

---

## View 层契约

### extension.ts
```typescript
// @contract: activate(context: vscode.ExtensionContext) => void
// @step: [注册命令] 注册所有 Command（compile, review, translate, analyze, init）
// @step: [注册菜单] 注册右键菜单和命令面板
// @step: [初始化服务] 初始化 ClaudeAPIService、FileRepository 等单例
// @boundary: 当激活失败时，记录错误日志但不阻塞 VSCode

// @contract: deactivate() => void
// @step: [清理] 清理所有 Disposable 资源
```

### HighlightDecorator
```typescript
// @contract: highlightLines(editor: vscode.TextEditor, lines: number[]) => void
// @step: [创建装饰] 创建红色波浪线装饰类型
// @step: [应用] 对指定行号应用装饰
// @boundary: 当编辑器已关闭时，静默跳过

// @contract: clearHighlights(editor: vscode.TextEditor) => void
// @step: [清除] 清除所有装饰
```

### OutputPanel
```typescript
// @contract: show(content: string, title: string) => void
// @step: [创建] 创建或复用 OutputChannel
// @step: [显示] 显示内容并聚焦面板
// @boundary: 当内容超过 10000 行时，截断并提示"内容过长，已截断"
```

---

## 错误类型定义

```typescript
// @contract: ValidationError extends Error
// 表示注释或代码格式不符合 CDD 规范

// @contract: FileNotFoundError extends Error
// 表示文件不存在

// @contract: PermissionError extends Error
// 表示无文件读写权限

// @contract: ConfigurationError extends Error
// 表示配置缺失（如 API Key）

// @contract: APIError extends Error
// 表示 Claude API 调用失败

// @contract: TimeoutError extends Error
// 表示 API 调用超时

// @contract: LogicUnclearError extends Error
// 表示代码逻辑混乱，无法转译

// @contract: UserCancelledError extends Error
// 表示用户取消操作
```

---

**版本：** 1.0.0  
**创建日期：** 2026-05-09  
**最后更新：** 2026-05-09
