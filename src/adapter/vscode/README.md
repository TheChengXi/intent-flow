# VSCode 适配层

VSCode 扩展适配层。将 CDD Framework 的核心能力集成到 VSCode IDE 中，
提供意图投射、文件大小检查等功能。

## 快速开始

```bash
npm run compile:vscode    # 构建扩展
# 在 VSCode 中按 F5 启动 Extension Development Host
```

## 入口

`src/adapter/vscode/extension.ts` — `package.json` 的 `main` 字段指向 `dist/extension.js`。

## 意图投射（核心功能）

激活扩展后，插件自动扫描工作区中每个文件顶部的 `@intent` 注释，
实时投射到 `.cdd/intents/` 目录树中。

```
项目根/
└── .cdd/intents/
    └── src/
        ├── application/
        │   └── CoreDIContainer.md    ← 单个文件意图
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
| `cdd.checkFileSize` | CDD: 检查文件大小 | 分析文件及其依赖树 |
| `cdd.openCapabilityMap` | CDD: 打开能力地图 | 可视化浏览项目意图 |

## 文件监听

扩展激活时自动启动文件监听：

- **全量同步** — 激活时扫描整个工作区，重建 `.cdd/intents/`
- **增量更新** — 监听文件保存、创建、删除，只更新受影响的文件
- **防抖** — 500ms 内的多次变更合并为一次更新
- **排除循环** — `.cdd/` 目录下的变更不会触发重新投射

监听器由 `src/adapter/vscode/services/IntentFileWatcher.ts` 实现。
