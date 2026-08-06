# converter.ts

`src/adapter/vscode/ui/webview/src/converter/converter.ts`

**intent:** 协议树百分比 → px 的递归换算器。 纯函数，无副作用，不引用任何框架。 换算规则遵循 CSS 百分比规范： width/height  → 参照容器的 width/height left/margin    → 参照容器 width（CSS 惯例） top            → 参照容器 height 使用方式： const compiled = compileTree(rawTree) const pxMap = convertTree(compiled, { width: 1200, height: 800 }) pxMap.get('page.header.title') // → { x: 0, y: 0, width: 720, height: 40 }
