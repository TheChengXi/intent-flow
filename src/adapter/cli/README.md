# CLI 适配层

CLI 命令入口，将核心 UseCase 暴露为终端命令。

## 快速开始

```bash
npm run compile:cli       # 构建到 dist/cli/cdd.js
node dist/cli/cdd.js --help  # 或安装后直接 cdd
```

## 入口

`src/adapter/cli/index.ts` — `bin` 字段指向 `dist/cli/cdd.js`。

## 构建

CLI 与扩展代码统一由根目录 `vite.config.ts` 编译。

## 运行

```bash
cdd check-file-size <filePath> [--workspace-root <path>] [--threshold <number>] [--json]
cdd project-intent <path> --intent <desc> [--force] [--json]
```

全局选项：

- `--help` / `-h` — 显示帮助
- `--json` — JSON 格式输出（每个命令均支持）
