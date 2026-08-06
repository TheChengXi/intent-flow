# RemoveFromIntentsCommand.ts

`src/adapter/vscode/commands/RemoveFromIntentsCommand.ts`

**intent:** VS Code 命令（右键菜单）：从意图扫描中排除选定文件夹。 - 如果文件夹在 roots 列表中 → 从 roots 移除 - 如果文件夹不在 roots 列表中 → 追加到 exclude 排除列表 触发全量重建使改动生效。
