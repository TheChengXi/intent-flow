# CDD 框架术语表

本文档定义 CDD（Contract-Driven Development）框架中使用的所有核心术语。

## 代码注解术语

### @intent（意图）
**定义**：描述一个文件将要实现或已实现的功能

**位置**：文件顶部，import 语句之前

**格式**：
```typescript
// @intent: 管理编译上下文的准备和保存
```

**作用**：让 agent 快速理解文件职责，无需读取文件内容

---

### @contract（契约）
**定义**：定义函数的签名，包括函数名、参数、返回值

**位置**：函数定义之前

**格式**：
```typescript
// @contract: functionName(param1: Type1, param2: Type2) => ReturnType
```

**作用**：明确函数的输入输出接口

---

### @step（步骤）
**定义**：定义函数执行的步骤流程

**位置**：@contract 之后，按执行顺序列出

**格式**：
```typescript
// @step: [步骤名称] 步骤描述
```

**作用**：描述函数的执行逻辑，指导代码实现

---

### @boundary（边界）
**定义**：定义函数的错误处理、限制条件、边界情况

**位置**：@step 之后

**格式**：
```typescript
// @boundary: 当某种情况发生时，应如何处理
```

**作用**：明确函数的错误处理策略和边界条件

---

### @end
**定义**：标记契约块的结束

**位置**：函数实现之后

**格式**：
```typescript
// @end
```

**作用**：明确契约块的范围

---

### @entity（实体）
**定义**：定义数据实体或类型

**位置**：类型定义之前

**格式**：
```typescript
// @entity: EntityName
// 实体描述
export interface EntityName {
  // ...
}
```

**作用**：标注数据实体，便于理解数据结构

---

### @dependency（依赖）
**定义**：当前文件依赖的其他模块

**提取方式**：通过 `ImportExtractor` 自动从 `import` 语句中提取

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

**命令**：`/structure`

**输出**：`.cdd/01-requirements.md`

**内容**：项目意图、用户群体、核心功能、业务规则、非功能需求、MVP 范围

---

### 架构设计（Architecture Design）
**目标**：确定技术栈、架构模式、模块划分

**命令**：`/architecture`

**输入**：`.cdd/01-requirements.md`

**输出**：`.cdd/02-architecture.md`

**内容**：项目类型、技术栈、架构模式、模块划分、模块通信、数据流向

---

### Model 设计（Model Design）
**目标**：设计数据实体、仓库、服务，并生成代码

**命令**：`/model-design`

**输入**：`.cdd/01-requirements.md`、`.cdd/02-architecture.md`

**输出**：
- `.cdd/03-model-design.md`（设计文档）
- `src/model/entities/`（实体代码）
- `src/model/repositories/`（仓库代码）
- `src/model/services/`（服务代码）

**特点**：唯一会生成实际代码的阶段

---

### ViewModel 设计（ViewModel Design）
**目标**：设计命令、上下文、角色，生成文件骨架

**命令**：`/viewmodel-design`

**输入**：`.cdd/01-requirements.md`、`.cdd/02-architecture.md`、`.cdd/03-model-design.md`

**输出**：
- `.cdd/04-viewmodel-design.md`（设计文档）
- `src/viewmodel/commands/`（命令骨架：@intent + import + 函数签名）
- `src/viewmodel/context/`（上下文骨架）
- `src/viewmodel/roles/`（角色骨架）

**特点**：生成文件骨架，不实现具体逻辑

---

### View 设计（View Design）
**目标**：设计界面、交互、组件，生成文件骨架

**命令**：`/view-design`

**输入**：`.cdd/01-requirements.md`、`.cdd/02-architecture.md`、`.cdd/03-model-design.md`、`.cdd/04-viewmodel-design.md`

**输出**：
- `.cdd/05-view-chat-design.md`（设计文档）
- `src/view/pages/`（页面骨架）
- `src/view/components/`（组件骨架）
- `src/chat/handlers/`（Chat 处理器骨架）

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
```
.cdd/
├── 01-requirements.md          # 需求文档
├── 02-architecture.md          # 架构设计
├── 03-model-design.md          # Model 设计
├── 04-viewmodel-design.md      # ViewModel 设计
└── 05-view-chat-design.md      # View/Chat 设计
```

### 代码结构
```
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
```

---

## 工具支持

### IntentExtractor
从文件中提取 @intent 注释，快速了解文件功能。

### ImportExtractor
从文件中提取 import 语句，自动构建依赖关系。

### DependencyTracker
追踪模块间的依赖关系，生成依赖关系图。

### CommentParser
解析 @contract、@step、@boundary 等注释，提取函数契约。
