# IntentFileWatcher.ts

`src/adapter/vscode/services/IntentFileWatcher.ts`

**intent:** VS Code 文件监听器，监听工作区文件变更并触发 .intentflow/intents/ 投射更新。 激活时执行全量同步，之后监听文件增/删/改做增量更新。 避免冗余触发：同一个文件 500ms 内的多次变更只执行一次。
