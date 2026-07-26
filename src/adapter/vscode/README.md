# VSCode 适配层

VSCode 扩展适配层。将 CDD Framework 的核心能力集成到 VSCode IDE 中，
提供命令面板、意图投射、Dry Run、代码审查等功能。

## 快速开始

```bash
npm run compile:vscode    # 构建扩展
# 在 VSCode 中按 F5 启动 Extension Development Host
```

## 入口

`src/adapter/vscode/extension.ts` — `package.json` 的 `main` 字段指向 `dist/extension.js`。

## 构建

扩展由根目录 `vite.config.ts` 编译，与 CLI、MCP 统一打包。

## 意图投射（核心功能）

激活扩展后，插件自动扫描工作区中每个文件顶部的 `@intent` 注释，
实时投射到 `.cdd/intents/` 目录树中。

```
项目根/
└── .cdd/intents/
    └── src/
        ├── application/
        │   ├── CoreDIContainer.md    ← 单个文件意图
        │   └── IntentPackageQueryService.md
        └── data/
            └── ...
```

**`.md` 文件内容示例：**
```markdown
# CoreDIContainer.ts

`src/application/CoreDIContainer.ts`

**intent:** 核心依赖注入容器，管理所有适配器共享的核心依赖。
```

### 用途

- **AI Agent 先导**：agent 直接 `ls .cdd/intents/` 即可了解项目全貌
- **快速查询**：`grep -r "关键字" .cdd/intents/` 按意图搜索
- **实时同步**：文件保存/增删后自动更新，无需手动操作

## 可用命令（VSCode 命令面板）

| 命令 ID | 标题 | 功能 |
|---|---|---|
| `cdd.projectIntents` | CDD: 重建意图投射目录 (.cdd/intents/) | 手动触发全量重建 |
| `cdd.compile` | CDD: 编译注释为代码 | 将 `@entity` 注释编译为代码骨架 |
| `cdd.review` | CDD: 审查代码 | 对选中代码进行 AI 审查 |
| `cdd.translate` | CDD: 翻译代码 | 翻译代码片段到目标语言 |
| `cdd.requirement-translator` | CDD: 翻译需求 | 将需求描述转换为代码 |
| `cdd.check-file-size` | CDD: 检查文件大小 | 分析文件及其依赖树 |
| `cdd.dryrun-toggle` | CDD: 切换 Dry Run | 开关 Dry Run 模式 |

## 添加新命令

1. 在 `commands/` 下新建命令文件
2. 在 `extension.ts` 的 `activate` 中注册 `vscode.commands.registerCommand`
3. 在 `package.json` 的 `contributes.commands` 添加声明

## 文件监听

扩展激活时自动启动文件监听：

- **全量同步** — 激活时扫描整个工作区，重建 `.cdd/intents/`
- **增量更新** — 监听文件保存、创建、删除，只更新受影响的文件
- **防抖** — 500ms 内的多次变更合并为一次更新
- **排除循环** — `.cdd/` 目录下的变更不会触发重新投射

监听器由 `src/adapter/vscode/services/IntentFileWatcher.ts` 实现。

## Dry Run 模式

启用后，所有 AI API 请求会被拦截并记录到输出面板，不实际发送。
用于调试和审查 AI 调用行为。
