# index.ts

`src/adapter/vscode/ui/webview/src/resource/text/index.ts`

**intent:** 文本资源统一预处理入口。 所有 resource/text/ 下的文本经过 Pretext prepare 缓存， 组件直接消费 PreparedText，后续 layout() 纯算术 0.0002ms。
