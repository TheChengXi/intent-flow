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
[MVC/MVVM/六边形架构/整洁架构/分层架构等]

**选择理由**：[为什么选择这个架构模式]

## 架构层次

### 数据层（Data Layer）
**职责**：数据实体、数据持久化、数据源管理

**包含**：
- 数据实体（Entities）
- 数据仓库接口（Repository Interfaces）
- 数据仓库实现（Repository Implementations）
- 数据服务（Data Services）

### 应用层（Application Layer）
**职责**：用例、业务规则、流程编排

**包含**：
- 用例/命令（Use Cases / Commands）
- 应用服务（Application Services）
- 业务规则（Business Rules）
- 上下文管理（Context Managers）

### 适配层（Adapter Layer）
**职责**：输入适配器（UI/API）、输出适配器（数据库/外部服务）

**包含**：
- 输入适配器（Input Adapters）：UI 组件、API Controller、CLI Handler
- 输出适配器（Output Adapters）：数据库实现、外部 API 客户端
- DTO/映射器（DTOs / Mappers）

## 模块划分

### 模块1：[模块名称]
**职责**：[模块的职责描述]
**所属层次**：[数据层/应用层/适配层]
**对外接口**：[暴露的接口/方法]
**依赖模块**：[依赖的其他模块]

### 模块2：[模块名称]
...

## 模块通信

### 适配层 → 应用层
**通信方式**：[调用用例/命令、传递 DTO]
**数据流向**：外部请求 → 适配层 → 应用层用例

### 应用层 → 数据层
**通信方式**：[调用仓库接口/数据服务]
**数据流向**：应用层 → 数据层仓库 → 数据存储

### 应用层 ↔ 应用层
**通信方式**：[事件总线/共享上下文/依赖注入]
**数据流向**：[描述数据流向]

## 数据流向

### 请求处理流
外部请求 → 适配层（输入适配器）→ 应用层（用例）→ 数据层（仓库）→ 数据存储

### 响应返回流
数据存储 → 数据层（仓库）→ 应用层（用例）→ 适配层（输出转换）→ 外部响应

### 状态管理
[描述状态管理方案：Context/Redux/无状态等]

### 数据缓存
[描述缓存策略：内存缓存/本地存储/IndexedDB/无缓存等]

## 目录结构

```
src/
├── data/                   # 数据层
│   ├── entities/          # 数据实体
│   ├── repositories/      # 数据仓库
│   └── services/          # 数据服务
├── application/           # 应用层
│   ├── commands/          # 命令/用例
│   ├── services/          # 应用服务
│   └── context/           # 上下文管理
└── adapter/               # 适配层
    ├── input/             # 输入适配器
    ├── output/            # 输出适配器
    └── dto/               # DTO/映射器
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
