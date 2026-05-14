# Comment-Driven Development (CDD) v3.0 - 工程实践版

## 范式声明

CDD 是一套基于"注释即源码"的工程实践方法，通过三个核心 Agent 函数（Compiler、Translator、Reviewer）实现注释与代码的双向转换和验证。

**核心理念**：注释定义"做什么"，代码实现"怎么做"。注释与代码通过 Agent 函数保持同步。

**当前状态**：本规范基于 CCD-framework 项目的实际工程实现，描述已验证的功能和架构。

**适用场景**：
- 需要长期维护的代码库
- 多人协作项目
- 需要代码可追溯性的场景
- 希望通过注释驱动开发的团队

---

## 一、核心概念

### 1.1 函数式提示词（当前实现）

使用三种注释标记定义函数行为：

```typescript
// @contract: functionName(param: Type) => ReturnType
// @step: [意图] 具体步骤描述
// @boundary: 当...时，应...
// ↓↓↓ 以下代码由 Compiler 生成 ↓↓↓
[实现代码]
// @end
```

**标记说明**：
- `@contract`: 函数签名，定义输入输出
- `@step`: 实现步骤，描述执行逻辑
- `@boundary`: 边界条件，定义异常处理
- `@end`: 代码块结束标记

### 1.2 三个核心 Agent 函数

#### Compiler（编译器）
- **输入**：CDD 注释 + 编译规范 + 引用契约
- **输出**：可执行代码
- **职责**：将注释翻译为代码，严格遵循编译规范

#### Translator（转译器）
- **输入**：代码 + 目标语言
- **输出**：CDD 注释
- **职责**：将代码逆向生成注释，保持注释与代码同步

#### Reviewer（审查员）
- **输入**：CDD 注释 + 代码 + 编译规范
- **输出**：审查报告
- **职责**：验证代码是否符合注释定义

### 1.3 工作流程

```
┌─────────────┐
│  写注释      │
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌─────────────┐
│  Compiler   │─────▶│  生成代码    │
└──────┬──────┘      └──────┬──────┘
       │                    │
       │                    ▼
       │             ┌─────────────┐
       │             │  Reviewer   │
       │             └──────┬──────┘
       │                    │
       │              ┌─────┴─────┐
       │              │           │
       ▼              ▼           ▼
    通过           不通过      修改代码
                      │           │
                      │           ▼
                      │    ┌─────────────┐
                      │    │ Translator  │
                      │    └──────┬──────┘
                      │           │
                      └───────────┴──────▶ 重新编译
```

---

## 二、Agent 函数规范

### 2.1 Compiler 函数

**函数签名**：
```typescript
compile(
  comment: string,
  targetLanguage: string,
  compileSpec?: string,
  referencedContracts?: string[],
  context?: {
    reviewFeedback?: string,
    previousCode?: string,
    stepDiff?: StepDiff,
    isIncremental?: boolean
  }
): string
```

**核心规则**：
1. 以 comment 为唯一需求来源，转译为 targetLanguage 代码
2. 若提供 compileSpec，严格遵循其规则
3. 实现所有 @step，处理所有 @boundary
4. 若提供 referencedContracts，参考其确保调用正确
5. 若提供 context.reviewFeedback，根据反馈修正代码
6. 若提供 context.isIncremental，基于 previousCode 增量修改
7. 输出纯代码，不包含注释、代码块标记或解释

**类型和导入规范**：
- 假设自定义类型已在项目中定义，提示用户添加 import
- 只有基础类型和标准库类型可以直接使用
- 不要自动创建接口定义

**错误处理**：
- 若无法翻译，输出：`<<BACKTRACK>> [原因]`

### 2.2 Translator 函数

**函数签名**：
```typescript
translate(
  code: string,
  targetLanguage: string,
  context?: {
    existingComment?: string,
    functionName?: string
  }
): string
```

**核心规则**：
1. 从 code 中提取函数签名，生成 @contract 行
2. 分析代码逻辑，识别关键步骤，生成 @step 行（3-7步为宜）
3. 识别异常处理、边界条件，生成 @boundary 行
4. 若提供 context.existingComment，在其基础上修正而非重写
5. 若提供 context.functionName，只转译该函数
6. 输出必须以注释符开头，以 @end 结尾
7. 不输出任何解释、分析或非注释内容

**注释符规范**：
- TypeScript/JavaScript/Java/C/C++/Go: `//`
- Python/Ruby/Shell: `#`
- SQL: `--`
- HTML/XML: `<!-- -->` 

**错误处理**：
- 若无法转译，输出：`<<BACKTRACK>> [原因]`

### 2.3 Reviewer 函数

**函数签名**：
```typescript
review(
  comment: string,
  code: string,
  compileSpec?: string
): ReviewReport
```

**审查维度**：
1. **代码有效性**：检查代码是否可执行（优先级最高）
2. **@contract 匹配**：函数签名是否一致
3. **@step 一致性**：代码逻辑是否符合步骤描述
4. **@boundary 处理**：边界条件是否正确处理
5. **多余行为**：是否存在注释未定义的行为
6. **COMPILE_SPEC 合规**：是否符合编译规范
7. **@end 完整性**：代码块是否正确结束

**输出格式**：
```
@contract 匹配: [PASS/WARN/FAIL] - [原因]
@step 一致性: [PASS/WARN/FAIL/SKIP] - [原因]
@boundary 处理: [PASS/WARN/FAIL/SKIP] - [原因]
多余行为: [PASS/WARN/FAIL] - [原因]
COMPILE_SPEC 合规: [PASS/WARN/FAIL/SKIP] - [原因]
@end 完整性: [PASS/WARN/FAIL] - [原因]
```

**核心规则**：
1. 若代码无效，立即输出 FAIL 并停止
2. 每个维度必须给出明确状态和原因
3. 若注释中无 @step，标记 SKIP
4. 若注释中无 @boundary，标记 SKIP
5. 若未提供 compileSpec，标记 SKIP

---

## 三、工程架构

### 3.1 核心模块

#### 代码分析模块（codeAnalysis/）
- **FunctionCallExtractor**：提取函数调用
- **TypeReferenceExtractor**：提取类型引用
- **ImportExtractor**：提取导入语句

#### 代码搜索模块（codeSearch/）
- **ContractSearcher**：搜索函数契约
- **TypeDefinitionSearcher**：搜索类型定义

#### 上下文管理
- **CompilerContextManager**：准备编译上下文
  - 解析注释
  - 提取依赖契约
  - 检测步骤差异
  - 加载审查反馈

#### 历史记录
- **HistoryService**：管理编译和审查历史
  - 保存编译记录
  - 保存审查记录
  - 查询历史记录

### 3.2 技术实现

#### Tree-sitter AST 解析
- 支持多语言：TypeScript、JavaScript、Python、Go、C/C++
- 自动回退机制：Tree-sitter 失败时回退到正则表达式
- 异步解析：所有提取器支持 async/await

#### 依赖提取策略
1. **类型依赖（父依赖）**：
   - 从 @contract 中提取类型引用
   - 在当前文件和导入文件中搜索类型定义
   
2. **函数依赖（子依赖）**：
   - 从 @step 和 @boundary 中提取函数调用
   - 在当前文件和导入文件中搜索函数契约
   - 支持函数重载检测

3. **导入语句检测**：
   - 提取已有的 import 语句
   - 避免重复导入

#### 增量编译
- **步骤差异检测**：比较当前注释与历史注释的 @step 差异
- **增量模式触发条件**：
  - 存在有效的历史编译记录
  - @contract 未改变
  - @step 仅有增删改，无结构性变化
- **增量编译**：基于 previousCode 修改，而非重新生成

### 3.3 文件结构

```
CCD-framework/
├── _source/
│   ├── CDD.md                    # 本规范文档
│   ├── COMPILE_SPEC.md           # 通用编译规范
│   ├── COMPILE_SPEC_FRONTEND.md  # 前端编译规范
│   ├── COMPILE_SPEC_BACKEND.md   # 后端编译规范
│   ├── COMPILE_SPEC_TEST.md      # 测试编译规范
│   └── prompts/
│       ├── compiler.md           # Compiler 函数规范
│       ├── translator.md         # Translator 函数规范
│       └── reviewer.md           # Reviewer 函数规范
├── src/
│   ├── model/
│   │   ├── entities/             # 数据实体
│   │   ├── repositories/         # 数据访问
│   │   └── services/
│   │       ├── codeAnalysis/     # 代码分析模块
│   │       ├── codeSearch/       # 代码搜索模块
│   │       ├── TreeSitterParser.ts
│   │       ├── WorkLineService.ts
│   │       └── HistoryService.ts
│   ├── viewmodel/
│   │   ├── roles/                # Agent VM
│   │   └── context/              # 上下文管理
│   └── view/                     # VSCode 扩展 UI
└── .cdd/
    ├── config.json               # 项目配置
    └── history/                  # 历史记录
        └── [filePath]/
            └── [functionName]/
                └── history.json
```

---

## 四、使用指南

### 4.1 VSCode 扩展使用

#### 编译注释为代码
1. 编写 CDD 注释（@contract + @step + @boundary）
2. 选中注释
3. 右键 → "CDD: Compile Comment to Code"
4. Compiler 生成代码并插入到注释下方

#### 审查代码
1. 选中注释和代码（包含 @end）
2. 右键 → "CDD: Review Code"
3. Reviewer 输出审查报告

#### 代码转注释
1. 选中代码
2. 右键 → "CDD: Translate Code to Comment"
3. Translator 生成注释并插入到代码上方

### 4.2 编译规范配置

#### 全局规范
在 `_source/COMPILE_SPEC.md` 中定义通用编译规范。

#### 分层规范
根据文件路径自动选择规范：
- 前端文件（src/view, src/components）→ COMPILE_SPEC_FRONTEND.md
- 后端文件（src/model, src/viewmodel）→ COMPILE_SPEC_BACKEND.md
- 测试文件（*.test.ts, */test/）→ COMPILE_SPEC_TEST.md

#### 自定义规则
在 `.cdd/config.json` 中配置：
```json
{
  "compileSpecRules": [
    {
      "pattern": "src/api/**/*.ts",
      "spec": "_source/COMPILE_SPEC_API.md"
    },
    {
      "pattern": "src/utils/**/*.ts",
      "spec": "_source/COMPILE_SPEC_UTILS.md"
    }
  ]
}
```

### 4.3 历史记录

每次编译和审查都会保存历史记录：
```
.cdd/history/[filePath]/[functionName]/history.json
```

历史记录用于：
- 增量编译（检测步骤差异）
- 审查反馈（加载上次审查结果）
- 依赖追踪（记录引用的契约版本）

---

## 五、工程实践原则

### 5.1 注释编写原则

#### 精确性
- 关键路径的 @step 必须精确到"人类审查员能明确判断对错"
- 禁止模糊词：如"校验"、"处理"、"有效"、"合理"
- 正确示例：`@step: [校验用户名] 校验 username 满足 ^[a-z0-9_]{3,20}$ 且未被占用，不满足则返回 ValidationError`

#### 简洁性
- @step 保持 3-7 步为宜
- 每个 @step 描述一个明确的操作
- 避免过度细化（如"声明变量"、"返回结果"）

#### 完整性
- @contract 必须包含所有参数和返回类型
- @boundary 必须覆盖所有异常情况
- 若函数抛出异常，在 @contract 中声明：`| throws ErrorType`

### 5.2 代码生成原则

#### 忠实性
- Compiler 严格按照注释生成代码
- 不添加注释未定义的功能
- 不省略注释要求的步骤

#### 规范性
- 遵循 COMPILE_SPEC 中的命名、格式、平台规则
- 使用项目已有的类型和函数
- 不自动创建未定义的接口

#### 可维护性
- 生成的代码应清晰易读
- 避免过度抽象和过早优化
- 保持代码结构与 @step 对应

### 5.3 审查原则

#### 严格性
- Reviewer 以注释为唯一标准
- 代码与注释不一致时，标记 FAIL
- 不因"代码更好"而放宽标准

#### 客观性
- 每个维度给出明确的 PASS/WARN/FAIL
- 必须说明原因，不能仅给出结论
- 避免主观判断（如"代码质量好"）

#### 可操作性
- FAIL 时必须指出具体问题
- 给出修正建议（修改注释或修改代码）
- 优先建议修改代码，除非注释本身有问题

---

## 六、已知限制与改进方向

### 6.1 当前限制

#### 信息保留率
- **当前水平**：40%（代码 → 注释 → 代码）
- **目标水平**：70-95%
- **主要损失**：
  - 实现细节（算法选择、数据结构）
  - 错误处理模式（重试、降级、熔断）
  - 性能优化（缓存、批处理、并发）

#### 上下文提取
- **已实现**：类型依赖、函数依赖、导入语句
- **未实现**：
  - 错误模式提取（try-catch 结构）
  - 数据流分析（变量依赖关系）
  - 控制流分析（分支、循环逻辑）

#### 多语言支持
- **完全支持**：TypeScript、JavaScript
- **部分支持**：Python、Go、C/C++
- **未支持**：Java、Rust、Kotlin 等

### 6.2 改进方向

#### 短期（1-2 个月）
1. **ContextExtractor**：提取实现上下文
   - 算法模式识别
   - 错误处理模式
   - 性能优化标记

2. **DependencyAnalyzer**：依赖关系分析
   - 数据流分析
   - 控制流分析
   - 副作用检测

3. **ErrorPatternDetector**：错误模式检测
   - try-catch 结构提取
   - 错误类型识别
   - 重试/降级策略

#### 中期（3-6 个月）
1. **面向对象式提示词**：
   - 类级别的 @contract
   - 方法间的依赖关系
   - 继承和组合的表达

2. **增强的增量编译**：
   - 更精细的差异检测
   - 部分函数重编译
   - 依赖变更传播

3. **自动化测试生成**：
   - 基于 @boundary 生成测试用例
   - 基于 @step 生成单元测试
   - 基于历史记录生成回归测试

#### 长期（6-12 个月）
1. **自举验证**：
   - 使用 CCD 框架验证自身代码
   - 三个 Agent 函数跑通整个项目
   - 注释与代码完全对照

2. **多项目支持**：
   - 跨项目契约引用
   - 共享类型库
   - 统一的编译规范

3. **智能优化**：
   - 基于历史记录的代码优化建议
   - 基于审查反馈的注释改进建议
   - 基于使用频率的契约推荐

---

## 七、实施路线图

### 阶段 1：自举验证（当前目标）

**目标**：使用 CCD 框架验证自身项目

**任务**：
1. 为所有核心模块添加完整的 CDD 注释
2. 使用 Compiler 重新生成代码
3. 使用 Reviewer 验证代码与注释一致性
4. 使用 Translator 反向验证注释完整性

**验收标准**：
- 所有核心模块通过 Reviewer 审查
- 代码 → 注释 → 代码的信息保留率 ≥ 60%
- 三个 Agent 函数能完整跑通项目

### 阶段 2：上下文增强

**目标**：提升信息保留率到 70%

**任务**：
1. 实现 ContextExtractor
2. 实现 DependencyAnalyzer
3. 实现 ErrorPatternDetector
4. 更新 Translator 使用新的提取器

**验收标准**：
- 代码 → 注释 → 代码的信息保留率 ≥ 70%
- 能够提取算法模式、错误处理、性能优化

### 阶段 3：面向对象支持

**目标**：支持类级别的 CDD 注释

**任务**：
1. 设计面向对象式提示词规范
2. 实现类级别的 Compiler
3. 实现类级别的 Translator
4. 实现类级别的 Reviewer

**验收标准**：
- 支持类、继承、组合的注释
- 支持方法间依赖的表达
- 通过面向对象项目验证

### 阶段 4：生态完善

**目标**：构建完整的 CDD 工具链

**任务**：
1. 自动化测试生成
2. 多项目支持
3. 智能优化建议
4. 社区规范和最佳实践

**验收标准**：
- 支持跨项目使用
- 提供完整的工具链
- 有成功的外部项目案例

---

## 八、版本信息

**范式名称**：Comment-Driven Development (CDD)  
**范式版本**：3.0  
**文档日期**：2026年5月14日  
**状态**：工程实践版

**与 v2.4.1 的主要差异**：
- 从理论范式转向工程实践
- 简化为三个核心 Agent 函数
- 基于实际代码库的架构描述
- 明确当前限制和改进方向
- 提供可执行的实施路线图

**历史版本**：
- v2.4.1：理论范式，11 个角色，完整工作流
- v3.0：工程实践版，3 个 Agent 函数，基于实际实现

---

**以上为 Comment-Driven Development (CDD) v3.0 完整文档。**
