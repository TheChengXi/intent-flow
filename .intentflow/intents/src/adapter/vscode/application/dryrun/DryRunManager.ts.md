# DryRunManager.ts

`src/adapter/vscode/application/dryrun/DryRunManager.ts`

**intent:** Dry Run 模式的核心状态管理器和拦截引擎。以单例模式运行，协调状态切换→请求拦截→文件保存→UI 通知的完整链路。 边界：拦截操作异步执行不阻塞主流程；文件保存失败时通过监听器降级到控制台输出
