# text-resolver.ts

`src/adapter/vscode/ui/webview/src/converter/text-resolver.ts`

**intent:** 基于 Pretext 的文本高度计算器工厂。 @boundary prepare 阶段在首次调用时惰性执行结果会被内层缓存复用。 仅在字体或文本变化时才重新 prepare，否则只跑 layout（纯算术）。
