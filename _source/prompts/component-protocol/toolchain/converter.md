# Converter — 换算层

协议 % CSS → 运行时 px 坐标的纯函数换算层。

框架无关 / 协议无关 / 输入相同输出一定相同。

## 核心函数

```
compileNode(css: CSSSkeleton)  →  { ratioWidth: number, ratioHeight: number }
  ── 将 '%' 字符串解析为比值（如 '8%' → 0.08）

convertTree(compiled, cw, ch)  →  LayoutNode[]（含 px 坐标）
  ── 递归换算整棵树，cmpileNode 的输出作为入参

TextHeightResolver(text, font) →  number
  ── 注入式文本高度计算接口（当前由 Pretext 或 DOM measure 实现）
```

## 换算流程

```
protocol.ts（8% / 10%）
    ↓
compileNode → { ratioWidth: 0.08, ratioHeight: 0.10 }
    ↓
convertTree(compiled, cw=1000, ch=600)
    ↓
{ w: 80, h: 60, left: ..., top: ... }（已转为 px）
    ↓
render.ts 读取 node.w / node.h，无需百分比感知
```

## proportions 处理

当 `protocol.ts` 中声明了 `proportions: [4, 1]`：

1. Converter 按正常流程计算 `width` 的 px 值
2. `height` 不再由独立百分比计算，而是：`height = width / (proportions[0] / proportions[1])`
3. 反之亦然（已知 height 时反向计算 width）

此逻辑在 convertTree 的可选参数中启用：

```
convertTree(compiled, cw, ch, {
  proportions: [4, 1]
})
```

## 工程特征

- 50-80 行纯函数，无外部依赖，可自己实现
- 可在 Node / Worker / 浏览器任意环境运行
- render.ts 永远只处理 px 值，协议永远只写百分比
- Converter 是两者之间唯一的桥接层
