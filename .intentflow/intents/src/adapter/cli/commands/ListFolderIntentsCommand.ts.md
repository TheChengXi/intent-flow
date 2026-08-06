# ListFolderIntentsCommand.ts

`src/adapter/cli/commands/ListFolderIntentsCommand.ts`

**intent:** CLI 命令：列出文件夹内所有文件的 @intent 意图清单。 注册为 `iflow list-folder-intents <folder>`，支持 --json 输出。 复用现有 CLI 参数解析模式（parseArgs / hasFlag）和 formatter（--json）。
