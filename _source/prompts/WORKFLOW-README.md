# CDD 流程式 Agent 设计

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
**命令**：`/structure`

**目录**：[structure/](structure/)

**目标**：收集业务需求，输出结构化需求文档

**输出**：`.cdd/01-requirements.md`

**触发条件**：用户想要开始新项目设计、明确需求

### 阶段 2：架构设计
**命令**：`/architecture`

**目录**：[architecture/](architecture/)

**目标**：确定技术栈、架构模式、模块划分

**输入**：`.cdd/01-requirements.md`

**输出**：`.cdd/02-architecture.md`

**触发条件**：用户完成需求结构化后想要设计架构

### 阶段 3：Model 设计
**命令**：`/model-design`

**目录**：[model-design/](model-design/)

**目标**：设计数据实体、仓库、服务，并生成 Model 层代码

**输入**：`.cdd/01-requirements.md`、`.cdd/02-architecture.md`

**输出**：
- `.cdd/03-model-design.md`（设计文档）
- `src/model/entities/`（实体代码）
- `src/model/repositories/`（仓库代码）
- `src/model/services/`（服务代码）

**特点**：唯一会生成实际代码的阶段

**触发条件**：用户完成架构设计后想要设计数据模型

### 阶段 4：ViewModel 设计
**命令**：`/viewmodel-design`

**目录**：[viewmodel-design/](viewmodel-design/)

**目标**：设计命令、上下文、角色，生成文件骨架

**输入**：`.cdd/01-requirements.md`、`.cdd/02-architecture.md`、`.cdd/03-model-design.md`

**输出**：
- `.cdd/04-viewmodel-design.md`（设计文档）
- `src/viewmodel/commands/`（命令骨架）
- `src/viewmodel/context/`（上下文骨架）
- `src/viewmodel/roles/`（角色骨架）

**特点**：生成文件骨架（@intent + import + @contract/@step/@boundary + 函数签名）

**触发条件**：用户完成 Model 设计后想要设计 ViewModel

### 阶段 5：View 设计
**命令**：`/view-design`

**目录**：[view-design/](view-design/)

**目标**：设计界面、交互、组件，生成文件骨架

**输入**：`.cdd/01-requirements.md`、`.cdd/02-architecture.md`、`.cdd/03-model-design.md`、`.cdd/04-viewmodel-design.md`

**输出**：
- `.cdd/05-view-chat-design.md`（设计文档）
- `src/view/pages/`（页面骨架）
- `src/view/components/`（组件骨架）
- `src/chat/handlers/`（Chat 处理器骨架）

**特点**：生成文件骨架（@intent + import + 组件结构）

**触发条件**：用户完成 ViewModel 设计后想要设计界面

## 使用方式

### 1. 顺序执行（推荐）
按照阶段顺序执行，每个阶段完成后用户确认才进入下一阶段：

```
/structure → /architecture → /model-design → /viewmodel-design → /view-design
```

**示例**：
```
@cdd /structure 我想做一个记账软件
@cdd /architecture 继续架构设计
@cdd /model-design 继续 Model 设计
@cdd /viewmodel-design 继续 ViewModel 设计
@cdd /view-design 继续 View 设计
```

### 2. 跳跃执行
用户可以从任意阶段开始，但需要手动提供前置阶段的输出文档。

**示例**：
```
@cdd /model-design 直接开始 Model 设计（需要先有 01-requirements.md 和 02-architecture.md）
```

### 3. 回退修改
允许回退到前面的阶段重新设计，后续阶段需要重新生成。

**示例**：
```
@cdd /architecture 重新设计架构（会影响后续的 Model、ViewModel、View 设计）
```

## 设计原则

### 单向依赖
```
View → ViewModel → Model
```
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
- [skills-main](https://github.com/anthropics/skills) - 参考项目
