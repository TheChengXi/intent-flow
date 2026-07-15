# VSCode 适配层

> v0.5 — 框选节点 / Ctrl+点单选 / B 键切换 / 复制地图联动

VSCode 扩展适配层。将 CDD Framework 的核心能力集成到 VSCode IDE 中，
提供命令面板、Dry Run、代码审查等功能。

## 快速开始

```bash
npm run compile:vscode    # 构建全部（扩展 + CLI + MCP + Webview）
# 在 VSCode 中按 F5 启动 Extension Development Host
```

## 入口

`src/adapter/vscode/extension.ts` — `package.json` 的 `main` 字段指向 `dist/extension.js`。

## 构建

扩展由根目录 `vite.config.ts` 编译，与 CLI、MCP 统一打包。
Webview 前端由 `src/adapter/vscode/ui/webview/vite.config.mts` 独立编译，
输出到 `dist/webview/`。

开发模式（F5）下优先连接 Vite Dev Server（需先启动）：
```bash
cd src/adapter/vscode/ui/webview
npx vite --config vite.config.mts
```
连接成功后支持 HMR，改 .vue 文件自动热更新。

## 可用命令（VSCode 命令面板）

| 命令 ID | 标题 | 功能 |
|---|---|---|
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

## Dry Run 模式

启用后，所有 AI API 请求会被拦截并记录到输出面板，不实际发送。
用于调试和审查 AI 调用行为。
