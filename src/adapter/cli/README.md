# CLI 适配层

CLI 命令入口，将 4 个 MCP 工具的相同 UseCase 暴露为终端命令。

## 快速开始

```bash
npm run compile:cli       # 构建到 dist/cli/cdd.js
node dist/cli/cdd.js --help  # 或安装后直接 cdd
```

## 入口

`src/adapter/cli/index.ts` — `bin` 字段指向 `dist/cli/cdd.js`。

## 构建

CLI 与扩展代码统一由根目录 `vite.config.ts` 编译，三个入口同时输出：
- `dist/extension.js` — VSCode 扩展
- `dist/cli/cdd.js` — CLI 工具
- `dist/mcp-server.js` — MCP 服务器

构建时还会额外拷贝 `parsers/*.wasm` 到 `dist/cli/`，
保证 Tree-sitter 的 WASM 回退路径正确。

## 添加新命令

1. 在 `commands/` 下新建 `XxxCommand.ts`
2. 导出 `command` / `description` / `usage` / `handler`
3. 在 `commands/index.ts` 的 `commandMap` 注册
4. 在 `CliDIContainer.ts` 添加对应的 UseCase getter（如果需要新的 UseCase）

## 运行

```bash
cdd check-file-size <filePath> [--workspace-root <path>] [--threshold <number>] [--json]
cdd trace-dependency-chain <entryFile> [--project-root <path>] [--mode simple|normal|complex] [--json]
cdd project-intent <path> --intent <desc> [--force] [--json]
cdd search-type <typeName> <filePath> [--language <lang>] [--json]
```

全局选项：

- `--help` / `-h` — 显示帮助
- `--json` — JSON 格式输出（每个命令均支持）
