# index.ts

`src/adapter/vscode/ui/webview/src/core/layout/index.ts`

**intent:** 纯布局算法。不依赖任何外部数据模型，只算树形图的排列位置。 分两遍： 第一遍 calcSubtreeWidth — 自底向上，每棵子树的宽度由最宽的子节点层决定 第二遍 layoutNode — 自顶向下，父节点水平居中于子节点中心上方
