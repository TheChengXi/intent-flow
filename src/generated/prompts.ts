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

export const GLOSSARY_PROMPT = `# CDD 框架术语表

本文档定义 CDD（Contract-Driven Development）框架中使用的所有核心术语。

## 代码注解术语

### @intent（意图）
**定义**：描述一个文件将要实现或已实现的功能

**位置**：文件顶部，import 语句之前

**格式**：
\`\`\`typescript
// @intent: 管理编译上下文的准备和保存
\`\`\`

**作用**：让 agent 快速理解文件职责，无需读取文件内容

---

### @contract（契约）
**定义**：定义函数的签名，包括函数名、参数、返回值

**位置**：函数定义之前

**格式**：
\`\`\`typescript
// @contract: functionName(param1: Type1, param2: Type2) => ReturnType
\`\`\`

**作用**：明确函数的输入输出接口

---

### @step（步骤）
**定义**：定义函数执行的步骤流程

**位置**：@contract 之后，按执行顺序列出

**格式**：
\`\`\`typescript
// @step: [步骤名称] 步骤描述
\`\`\`

**作用**：描述函数的执行逻辑，指导代码实现

---

### @boundary（边界）
**定义**：定义函数的错误处理、限制条件、边界情况

**位置**：@step 之后

**格式**：
\`\`\`typescript
// @boundary: 当某种情况发生时，应如何处理
\`\`\`

**作用**：明确函数的错误处理策略和边界条件

---

### @end
**定义**：标记契约块的结束

**位置**：函数实现之后

**格式**：
\`\`\`typescript
// @end
\`\`\`

**作用**：明确契约块的范围

---

### @entity（实体）
**定义**：定义数据实体或类型

**位置**：类型定义之前

**格式**：
\`\`\`typescript
// @entity: EntityName
// 实体描述
export interface EntityName {
  // ...
}
\`\`\`

**作用**：标注数据实体，便于理解数据结构

---

### @dependency（依赖）
**定义**：当前文件依赖的其他模块

**提取方式**：通过 \`ImportExtractor\` 自动从 \`import\` 语句中提取

**注意**：不需要手动标注，系统会自动分析

---

## 架构术语

### Model 层（模型层）
**定义**：数据实体、数据持久化、业务服务

**职责**：
- 定义数据实体（Entities）
- 管理数据持久化（Repositories）
- 实现业务逻辑（Services）

**特点**：
- 纯数据层，不包含 UI 逻辑
- 不依赖 ViewModel 和 View 层
- 不需要标注 @intent（因为是纯数据实体）

---

### ViewModel 层（视图模型层）
**定义**：状态管理、用户操作处理、业务逻辑编排

**职责**：
- 管理应用状态（State）
- 处理用户命令（Commands）
- 管理上下文（Context Managers）
- 编排业务逻辑（Roles）

**特点**：
- 只能依赖 Model 层
- 不能依赖 View 层
- 必须标注 @intent
- 依赖通过 import 语句声明

**依赖规则**：View → ViewModel → Model（单向依赖）

---

### View 层（视图层）
**定义**：UI 组件、页面、用户交互

**职责**：
- 渲染用户界面（Components）
- 处理用户交互（Event Handlers）
- 展示数据（Pages）

**特点**：
- 只能依赖 ViewModel 层
- 不能直接依赖 Model 层
- 必须标注 @intent
- 依赖通过 import 语句声明

---

### Chat 层（对话层）
**定义**：对话式交互界面

**职责**：
- 处理用户消息（Message Handlers）
- 管理对话状态（Conversation State）
- 生成响应（Response Generation）

**特点**：
- 与 View 层平级，都属于表现层
- 只能依赖 ViewModel 层
- 必须标注 @intent

---

## 设计流程术语

### 需求结构化（Structure）
**目标**：收集业务需求，输出结构化需求文档

**命令**：\`/structure\`

**输出**：\`.cdd/01-requirements.md\`

**内容**：项目意图、用户群体、核心功能、业务规则、非功能需求、MVP 范围

---

### 架构设计（Architecture Design）
**目标**：确定技术栈、架构模式、模块划分

**命令**：\`/architecture\`

**输入**：\`.cdd/01-requirements.md\`

**输出**：\`.cdd/02-architecture.md\`

**内容**：项目类型、技术栈、架构模式、模块划分、模块通信、数据流向

---

### Model 设计（Model Design）
**目标**：设计数据实体、仓库、服务，并生成代码

**命令**：\`/model-design\`

**输入**：\`.cdd/01-requirements.md\`、\`.cdd/02-architecture.md\`

**输出**：
- \`.cdd/03-model-design.md\`（设计文档）
- \`src/model/entities/\`（实体代码）
- \`src/model/repositories/\`（仓库代码）
- \`src/model/services/\`（服务代码）

**特点**：唯一会生成实际代码的阶段

---

### ViewModel 设计（ViewModel Design）
**目标**：设计命令、上下文、角色，生成文件骨架

**命令**：\`/viewmodel-design\`

**输入**：\`.cdd/01-requirements.md\`、\`.cdd/02-architecture.md\`、\`.cdd/03-model-design.md\`

**输出**：
- \`.cdd/04-viewmodel-design.md\`（设计文档）
- \`src/viewmodel/commands/\`（命令骨架：@intent + import + 函数签名）
- \`src/viewmodel/context/\`（上下文骨架）
- \`src/viewmodel/roles/\`（角色骨架）

**特点**：生成文件骨架，不实现具体逻辑

---

### View 设计（View Design）
**目标**：设计界面、交互、组件，生成文件骨架

**命令**：\`/view-design\`

**输入**：\`.cdd/01-requirements.md\`、\`.cdd/02-architecture.md\`、\`.cdd/03-model-design.md\`、\`.cdd/04-viewmodel-design.md\`

**输出**：
- \`.cdd/05-view-chat-design.md\`（设计文档）
- \`src/view/pages/\`（页面骨架）
- \`src/view/components/\`（组件骨架）
- \`src/chat/handlers/\`（Chat 处理器骨架）

**特点**：生成文件骨架，不实现具体逻辑

---

## 设计原则

### 单向依赖
View → ViewModel → Model

表现层只能依赖模块层，模块层只能依赖模型层。

### 职责分明
- Model：数据和业务逻辑
- ViewModel：状态管理和命令处理
- View/Chat：用户界面和交互

### 渐进式设计
需求结构化 → 架构设计 → Model 设计 → ViewModel 设计 → View 设计

每个阶段完成后，用户确认才进入下一阶段。

### 弱依赖
每个阶段可以独立执行，但需要明确标注前置依赖。

用户可以从任意阶段开始，跳过的阶段需要手动提供输入。

---

## 文件组织

### 设计文档
\`\`\`
.cdd/
├── 01-requirements.md          # 需求文档
├── 02-architecture.md          # 架构设计
├── 03-model-design.md          # Model 设计
├── 04-viewmodel-design.md      # ViewModel 设计
└── 05-view-chat-design.md      # View/Chat 设计
\`\`\`

### 代码结构
\`\`\`
src/
├── model/                      # Model 层
│   ├── entities/              # 数据实体
│   ├── repositories/          # 数据仓库
│   └── services/              # 业务服务
├── viewmodel/                 # ViewModel 层
│   ├── commands/              # 命令处理器
│   ├── context/               # 上下文管理器
│   └── roles/                 # 角色/功能模块
├── view/                      # View 层
│   ├── pages/                 # 页面组件
│   └── components/            # 可复用组件
└── chat/                      # Chat 层
    └── handlers/              # 消息处理器
\`\`\`

---

## 工具支持

### IntentExtractor
从文件中提取 @intent 注释，快速了解文件功能。

### ImportExtractor
从文件中提取 import 语句，自动构建依赖关系。

### DependencyTracker
追踪模块间的依赖关系，生成依赖关系图。

### CommentParser
解析 @contract、@step、@boundary 等注释，提取函数契约。`;

export const REQUIREMENT_TRANSLATOR_PROMPT = `# 需求转译器提示词模板

你是一位需求转译器。负责将自然语言需求转译为 CDD 格式的注释。

## 输入信息

### 需求描述
{{requirement}}

### 上下文信息
{{context}}

## 你的任务

将需求转译为 CDD 格式的注释，包含：
1. @contract: 函数签名
2. @step: 实现步骤
3. @boundary: 边界条件和错误处理

## 输出格式


// @contract: functionName(param: Type) => ReturnType
// @step: [意图] 具体步骤描述
// @step: [意图] 具体步骤描述
// @boundary: 当...时，应...


## 注意事项

- @step 描述"做什么"（What），不是"怎么做"（How）
- @step 要精确到可验证的程度
- @boundary 包含边界条件和错误处理策略
- 不要添加代码实现，只输出注释
- 如果需求涉及多个函数，为每个函数生成独立的注释块`;

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

export const WORKFLOW_README_PROMPT = `# CDD 流程式 Agent 设计

本目录包含 CDD 框架的流程式 agent 设计，用于指导项目从需求分析到界面设计的完整流程。

## 设计理念

借鉴 [skills-main](https://github.com/anthropics/skills) 项目的最佳实践：
- **渐进式披露**：主 SKILL.md 保持简洁，详细内容拆分到独立文件
- **简洁明确**：删除冗长的示例代码，用清晰的步骤和原则代替
- **阶段化流程**：每个阶段有明确的目标和检查点
- **术语一致性**：使用统一的术语表（GLOSSARY.md）

## 核心术语

参见 [GLOSSARY.md](GLOSSARY.md) 了解所有术语定义，包括：
- **@intent**、**@contract**、**@step**、**@boundary**、**@end**、**@entity**
- **Model 层**、**ViewModel 层**、**View 层**、**Chat 层**
- **需求结构化**、**架构设计**、**Model 设计**、**ViewModel 设计**、**View 设计**

## 流程阶段

### 阶段 1：需求结构化
**命令**：\`/structure\`

**目录**：[structure/](structure/)

**目标**：收集业务需求，输出结构化需求文档

**输出**：\`.cdd/01-requirements.md\`

**触发条件**：用户想要开始新项目设计、明确需求

### 阶段 2：架构设计
**命令**：\`/architecture\`

**目录**：[architecture/](architecture/)

**目标**：确定技术栈、架构模式、模块划分

**输入**：\`.cdd/01-requirements.md\`

**输出**：\`.cdd/02-architecture.md\`

**触发条件**：用户完成需求结构化后想要设计架构

### 阶段 3：Model 设计
**命令**：\`/model-design\`

**目录**：[model-design/](model-design/)

**目标**：设计数据实体、仓库、服务，并生成 Model 层代码

**输入**：\`.cdd/01-requirements.md\`、\`.cdd/02-architecture.md\`

**输出**：
- \`.cdd/03-model-design.md\`（设计文档）
- \`src/model/entities/\`（实体代码）
- \`src/model/repositories/\`（仓库代码）
- \`src/model/services/\`（服务代码）

**特点**：唯一会生成实际代码的阶段

**触发条件**：用户完成架构设计后想要设计数据模型

### 阶段 4：ViewModel 设计
**命令**：\`/viewmodel-design\`

**目录**：[viewmodel-design/](viewmodel-design/)

**目标**：设计命令、上下文、角色，生成文件骨架

**输入**：\`.cdd/01-requirements.md\`、\`.cdd/02-architecture.md\`、\`.cdd/03-model-design.md\`

**输出**：
- \`.cdd/04-viewmodel-design.md\`（设计文档）
- \`src/viewmodel/commands/\`（命令骨架）
- \`src/viewmodel/context/\`（上下文骨架）
- \`src/viewmodel/roles/\`（角色骨架）

**特点**：生成文件骨架（@intent + import + @contract/@step/@boundary + 函数签名）

**触发条件**：用户完成 Model 设计后想要设计 ViewModel

### 阶段 5：View 设计
**命令**：\`/view-design\`

**目录**：[view-design/](view-design/)

**目标**：设计界面、交互、组件，生成文件骨架

**输入**：\`.cdd/01-requirements.md\`、\`.cdd/02-architecture.md\`、\`.cdd/03-model-design.md\`、\`.cdd/04-viewmodel-design.md\`

**输出**：
- \`.cdd/05-view-chat-design.md\`（设计文档）
- \`src/view/pages/\`（页面骨架）
- \`src/view/components/\`（组件骨架）
- \`src/chat/handlers/\`（Chat 处理器骨架）

**特点**：生成文件骨架（@intent + import + 组件结构）

**触发条件**：用户完成 ViewModel 设计后想要设计界面

## 使用方式

### 1. 顺序执行（推荐）
按照阶段顺序执行，每个阶段完成后用户确认才进入下一阶段：

\`\`\`
/structure → /architecture → /model-design → /viewmodel-design → /view-design
\`\`\`

**示例**：
\`\`\`
@cdd /structure 我想做一个记账软件
@cdd /architecture 继续架构设计
@cdd /model-design 继续 Model 设计
@cdd /viewmodel-design 继续 ViewModel 设计
@cdd /view-design 继续 View 设计
\`\`\`

### 2. 跳跃执行
用户可以从任意阶段开始，但需要手动提供前置阶段的输出文档。

**示例**：
\`\`\`
@cdd /model-design 直接开始 Model 设计（需要先有 01-requirements.md 和 02-architecture.md）
\`\`\`

### 3. 回退修改
允许回退到前面的阶段重新设计，后续阶段需要重新生成。

**示例**：
\`\`\`
@cdd /architecture 重新设计架构（会影响后续的 Model、ViewModel、View 设计）
\`\`\`

## 设计原则

### 单向依赖
\`\`\`
View → ViewModel → Model
\`\`\`
表现层只能依赖模块层，模块层只能依赖模型层。

### 职责分明
- **Model**：数据和业务逻辑
- **ViewModel**：状态管理和命令处理
- **View/Chat**：用户界面和交互

### 渐进式设计
每个阶段完成后，用户确认才进入下一阶段。

### 弱依赖
每个阶段可以独立执行，但需要明确标注前置依赖。

## 文件组织

### 设计文档
\`\`\`
.cdd/
├── 01-requirements.md          # 需求文档
├── 02-architecture.md          # 架构设计
├── 03-model-design.md          # Model 设计
├── 04-viewmodel-design.md      # ViewModel 设计
└── 05-view-chat-design.md      # View/Chat 设计
\`\`\`

### 代码结构
\`\`\`
src/
├── model/                      # Model 层
│   ├── entities/              # 数据实体
│   ├── repositories/          # 数据仓库
│   └── services/              # 业务服务
├── viewmodel/                 # ViewModel 层
│   ├── commands/              # 命令处理器
│   ├── context/               # 上下文管理器
│   └── roles/                 # 角色/功能模块
├── view/                      # View 层
│   ├── pages/                 # 页面组件
│   └── components/            # 可复用组件
└── chat/                      # Chat 层
    └── handlers/              # 消息处理器
\`\`\`

## 与原有 prompt 的区别

### 旧设计（角色式）
- 单个大文件，包含所有阶段
- 冗长的示例代码
- 一次性输出完整文档

### 新设计（流程式）
- 每个阶段独立目录
- 简洁的步骤和原则
- 阶段性输出，用户确认后继续
- 借鉴 skills-main 的渐进式披露

## 工具支持

- **IntentExtractor**：提取 @intent 注释
- **ImportExtractor**：提取 import 语句，构建依赖关系
- **DependencyTracker**：追踪模块依赖
- **CommentParser**：解析 @contract、@step、@boundary

## 参考资料

- [GLOSSARY.md](GLOSSARY.md) - 术语表
- [skills-main](https://github.com/anthropics/skills) - 参考项目`;

