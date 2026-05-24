# 架构设计文档输出格式

当所有架构决策确定后，按照以下格式输出架构设计文档：

```markdown
# 架构设计文档：[项目名称]

## 项目类型
[Web应用/CLI工具/库/API/桌面应用/VSCode扩展等]

## 运行环境
[浏览器/Node.js/Electron/VSCode等]

## 技术栈

### 核心技术
- **语言**：[TypeScript/JavaScript/Python/Go等]
- **框架**：[React/Vue/Express/FastAPI等]
- **构建工具**：[Webpack/Vite/Rollup/esbuild等]

### 前端技术（如果适用）
- **UI 框架**：[React/Vue/Angular等]
- **状态管理**：[Redux/Zustand/Context等]
- **UI 库**：[Ant Design/Material-UI/Tailwind CSS等]
- **路由**：[React Router/Vue Router等]

### 后端技术（如果适用）
- **框架**：[Express/Koa/FastAPI/Gin等]
- **数据库**：[PostgreSQL/MySQL/MongoDB/SQLite等]
- **ORM**：[Prisma/TypeORM/Sequelize等]

### 工具链
- **包管理器**：[npm/yarn/pnpm等]
- **代码规范**：[ESLint/Prettier等]
- **测试框架**：[Jest/Vitest/Mocha等]

## 架构模式
[MVC/MVVM/三层架构/Clean Architecture等]

**选择理由**：[为什么选择这个架构模式]

## 架构层次

### Model 层
**职责**：数据实体、数据持久化、业务服务

**包含**：
- 数据实体（Entities）
- 数据仓库（Repositories）
- 业务服务（Services）

### ViewModel 层
**职责**：状态管理、用户操作处理、业务逻辑编排

**包含**：
- 状态管理（State）
- 命令处理（Commands）
- 上下文管理（Context Managers）

### View 层
**职责**：UI 组件、页面、用户交互

**包含**：
- UI 组件（Components）
- 页面（Pages）
- 交互处理（Event Handlers）

## 模块划分

### 模块1：[模块名称]
**职责**：[模块的职责描述]
**所属层次**：[Model/ViewModel/View]
**对外接口**：[暴露的接口/方法]
**依赖模块**：[依赖的其他模块]

### 模块2：[模块名称]
...

## 模块通信

### View → ViewModel
**通信方式**：[事件/方法调用/Props传递]
**数据流向**：用户操作 → View 事件 → ViewModel 命令

### ViewModel → Model
**通信方式**：[服务/仓库接口调用]
**数据流向**：ViewModel 调用 → Model 服务 → 数据持久化

### ViewModel ↔ ViewModel
**通信方式**：[事件总线/共享状态/依赖注入]
**数据流向**：[描述数据流向]

## 数据流向

### 用户输入流
用户操作 → View 组件 → ViewModel 命令 → Model 服务 → 数据存储

### 数据展示流
数据存储 → Model 服务 → ViewModel 状态 → View 组件 → 用户界面

### 状态管理
[描述状态管理方案：Redux/Zustand/Context/无状态等]

### 数据缓存
[描述缓存策略：内存缓存/本地存储/IndexedDB/无缓存等]

## 目录结构

```
src/
├── model/                  # Model 层
│   ├── entities/          # 数据实体
│   ├── repositories/      # 数据仓库
│   └── services/          # 业务服务
├── viewmodel/             # ViewModel 层
│   ├── commands/          # 命令处理
│   ├── context/           # 上下文管理
│   └── roles/             # 角色/功能模块
└── view/                  # View 层
    ├── components/        # UI 组件
    └── pages/             # 页面
```

## 扩展性设计

### 插件机制
[是否需要插件机制？如何实现？]

### 配置管理
[配置文件格式、配置加载方式]

### 错误处理
[全局错误处理策略]

### 日志记录
[日志记录方案]

## 性能优化策略

- [策略1]
- [策略2]
...

## 安全考虑

- [安全措施1]
- [安全措施2]
...
```
