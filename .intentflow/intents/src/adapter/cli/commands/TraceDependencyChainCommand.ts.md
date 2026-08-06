# TraceDependencyChainCommand.ts

`src/adapter/cli/commands/TraceDependencyChainCommand.ts`

**intent:** 将原始 CLI 参数翻译为 TraceDependencyChainUseCase 的输入协定。定义 CLI 特有逻辑：mode 取值校验（仅 simple/normal/complex）、projectRoot 默认 cwd
