# @pixel-ratio/core

将协议树中的百分比值递归换算为像素坐标。纯函数，零依赖。

## 定位

```
组件树（百分比）           换算层（纯函数）              渲染层（px）

ConvertNode ──→ compileNode() ──→ CompiledNode ──→ convertTree() ──→ Map<id, PxBounds>
                                           ↑                          ↑
                                     containerBounds              消费 px 坐标
                                    （外部传入 cw/ch）           画到 Canvas / DOM / SVG
```

## 安装

```bash
npm install @pixel-ratio/core
```

## 使用

```ts
import { compileNode, convertTree } from '@pixel-ratio/core'
import type { ConvertNode } from '@pixel-ratio/core'

const tree: ConvertNode = {
  identity: 'root',
  css: { width: '100%', height: '100%' },
  slots: [{
    name: 'body',
    children: [
      {
        identity: 'header',
        css: { width: '100%', height: '15%' },
        slots: [{
          name: 'title',
          children: [{
            identity: 'title-text',
            css: { width: '60%', height: 'auto' },
            textContent: 'Hello',
            textFont: '14px sans-serif',
            textLineHeight: 20,
          }]
        }]
      },
      {
        identity: 'body-area',
        css: { width: '100%', height: '85%' },
      }
    ]
  }]
}

const compiled = compileNode(tree)
const pxMap = convertTree(compiled, 1200, 800)
// pxMap.get('header')      → { x: 0, y: 0, width: 1200, height: 120 }
// pxMap.get('title-text')  → { x: 0, y: 0, width: 720, height: 20 }
// pxMap.get('body-area')   → { x: 0, y: 120, width: 1200, height: 680 }
```

## 核心原则

1. **纯函数** — 无副作用，输入相同输出一定相同
2. **递归** — 父组件的 px 边界 = 子组件的容器基准
3. **框架无关** — 不 import 任何 UI 框架
4. **两阶段设计** — `compileNode` 提前解析百分比为比值，`convertTree` 只做乘法

## 插件

```bash
npm install @pixel-ratio/pretext
```

```ts
import { createPretextResolver } from '@pixel-ratio/pretext'

const resolveText = createPretextResolver()
const pxMap = convertTree(compiled, 1200, 800, resolveText)
```

## API

| 函数 | 输入 | 输出 |
|------|------|------|
| `compileNode(raw)` | `ConvertNode`（含 "%" 字符串） | `CompiledNode`（比值 0~1） |
| `convertNode(node, pw, ph)` | 单个 `CompiledNode` + 容器 px | `PxBounds` |
| `convertTree(root, cw, ch)` | 整棵 `CompiledNode` 树 + 容器 px | `Map<identity, PxBounds>` |

完整类型见 [types.ts](./types.ts)。
