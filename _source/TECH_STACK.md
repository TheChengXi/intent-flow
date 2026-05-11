# TECH_STACK.md

## 技术栈选型

### 核心技术
- **开发语言：** TypeScript 5.x
- **运行环境：** VSCode Extension Host (Node.js)
- **AI 集成：** Anthropic Claude API (claude-4.6-sonnet-medium)
- **文件系统：** Node.js fs/promises

### VSCode Extension 依赖
- **Extension API：** vscode ^1.85.0
- **激活事件：** onCommand, onLanguage:typescript
- **贡献点：** commands, menus (editor/context, commandPalette)

### 开发工具链
- **构建工具：** esbuild (VSCode 推荐)
- **包管理器：** npm
- **代码规范：** ESLint + Prettier
- **类型检查：** TypeScript strict mode

---

## 模块划分（MVVM 架构）

### Model 层（数据与业务逻辑）
```
src/model/
├── entities/
│   ├── CDDComment.ts          # @contract/@step/@boundary 数据结构
│   ├── CompileRecord.ts       # WorkSchedule 记录实体
│   └── ReviewReport.ts        # 审查报告实体
├── repositories/
│   ├── FileRepository.ts      # 文件读写抽象
│   ├── WorkScheduleRepo.ts    # WorkSchedule.md 操作
│   └── ChangelogRepo.ts       # CHANGELOG.md 操作
└── services/
    ├── ClaudeAPIService.ts    # API 调用封装
    ├── CommentParser.ts       # 注释解析器
    └── DependencyTracker.ts   # 契约依赖追踪
```

### ViewModel 层（状态管理与命令逻辑）
```
src/viewmodel/
├── roles/
│   ├── ProductManagerVM.ts    # 产品经理角色
│   ├── TranslatorVM.ts        # 自然语言转译员
│   ├── CompilerVM.ts          # 编译器
│   ├── ReviewerVM.ts          # 代码审查员
│   ├── CodeTranslatorVM.ts    # 代码转译员
│   └── PlannerVM.ts           # 迭代规划师
├── commands/
│   ├── CompileCommand.ts      # "CDD: 编译注释"
│   ├── ReviewCommand.ts       # "CDD: 审查代码"
│   ├── TranslateCommand.ts    # "CDD: 转译为注释"
│   ├── AnalyzeCommand.ts      # "CDD: 分析变更影响"
│   └── InitCommand.ts         # "CDD: 初始化项目"
└── shared/
    ├── CommandContext.ts      # 命令执行上下文
    └── RoleOrchestrator.ts    # 角色调度器
```

### View 层（VSCode UI 集成）
```
src/view/
├── extension.ts               # 插件入口
├── menus/
│   └── contextMenu.ts         # 右键菜单注册
├── panels/
│   └── OutputPanel.ts         # 输出面板（显示报告）
└── decorations/
    └── HighlightDecorator.ts  # 代码高亮（不一致标记）
```

---

## 模块关系（继承/组合）

### 继承关系
```
BaseRole (抽象基类)
  ├── ProductManagerVM
  ├── TranslatorVM
  ├── CompilerVM
  ├── ReviewerVM
  ├── CodeTranslatorVM
  └── PlannerVM

BaseCommand (抽象基类)
  ├── CompileCommand
  ├── ReviewCommand
  ├── TranslateCommand
  ├── AnalyzeCommand
  └── InitCommand
```

### 组合关系
```
CompileCommand
  ├── 依赖 CommentParser (解析注释)
  ├── 依赖 CompilerVM (生成代码)
  ├── 依赖 WorkScheduleRepo (记录日志)
  └── 触发 ReviewCommand (自动审查)

ReviewCommand
  ├── 依赖 CommentParser (解析注释)
  ├── 依赖 ReviewerVM (审查逻辑)
  ├── 依赖 FileRepository (读取 COMPILE_SPEC)
  └── 依赖 HighlightDecorator (标记不一致)

RoleOrchestrator
  ├── 管理所有 Role 实例
  └── 负责角色间交接钩子
```

---

## 目录结构

```
cdd-validator/
├── _source/                   # CDD 核心文档（项目自身遵循 CDD）
│   ├── PROJECT_SOUL.md
│   ├── BUSINESS_RULES.md
│   ├── TECH_STACK.md
│   ├── CONTRACTS.md
│   ├── COMPILE_SPEC.md
│   └── CHANGELOG.md
├── src/
│   ├── model/
│   ├── viewmodel/
│   ├── view/
│   └── extension.ts
├── templates/                 # 初始化项目时的文件模板
│   ├── PROJECT_SOUL.template.md
│   ├── BUSINESS_RULES.template.md
│   └── ...
├── test/
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── WorkSchedule.md
└── REVIEW_REPORT.md
```

---

## Model 层内部结构设计

### CDDComment 实体
```typescript
interface CDDComment {
  contract: ContractAnnotation;
  steps: StepAnnotation[];
  boundaries: BoundaryAnnotation[];
  range: vscode.Range;  // 在文档中的位置
}

interface ContractAnnotation {
  functionName: string;
  parameters: Parameter[];
  returnType: string;
  throwsTypes: string[];
  version: string;  // 用于依赖追踪
}

interface StepAnnotation {
  intent: string;
  description: string;
  isSimple: boolean;  // 是否标记 @simple
}

interface BoundaryAnnotation {
  condition: string;  // "当...时"
  action: string;     // "应..."
}
```

### CompileRecord 实体
```typescript
interface CompileRecord {
  date: string;
  time: string;
  role: string;
  description: string;
  duration: number;  // 秒
  dependencies: ContractDependency[];
}

interface ContractDependency {
  contractName: string;
  version: string;
}
```

### ReviewReport 实体
```typescript
interface ReviewReport {
  functionName: string;
  date: string;
  dimensions: ReviewDimension[];
  conclusion: 'PASS' | 'MINOR_DEVIATION' | 'MAJOR_VIOLATION';
  inconsistencies: Inconsistency[];
}

interface ReviewDimension {
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  details: string;
}

interface Inconsistency {
  line: number;
  type: 'CONTRACT_MISMATCH' | 'STEP_MISSING' | 'BOUNDARY_MISSING' | 'EXTRA_BEHAVIOR';
  description: string;
}
```

---

## 通信协议

### 角色间交接钩子
每个 Role 完成后返回 `RoleResult`：
```typescript
interface RoleResult {
  success: boolean;
  message: string;
  nextRole?: string;  // 建议下一步激活的角色
  artifacts?: any;    // 产出物（如生成的代码、报告）
}
```

### API 调用协议
```typescript
interface ClaudeAPIRequest {
  role: string;  // 'compiler' | 'reviewer' | 'translator'
  context: {
    comment?: CDDComment;
    code?: string;
    compileSpec?: string;
  };
  prompt: string;
}

interface ClaudeAPIResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}
```

---

**版本：** 1.0.0  
**创建日期：** 2026-05-09  
**最后更新：** 2026-05-09
