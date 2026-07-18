# 快速启动

三步上手。

## 1. 定义协议

```
components/button/protocol.ts

export const css = {
  width: '15%',
  height: '5%',
  proportions: [3, 1],  // 按钮保持 3:1 比例
}
```

## 2. 实现渲染

```
components/button/render.ts

// render 只消费 px 坐标，不关心百分比
export function render(ctx: RenderContext) {
  const { parent, node, tokens } = ctx
  // node.w / node.h / node.left / node.top 已是 px 值
  drawRect(parent, node.w, node.h, tokens.primary)
}
```

## 3. 接入换算层

```
import { compileNode, convertTree } from './converter'

const compiled = compileNode(protocol.css)        // '15%' → 0.15
const px = convertTree([compiled], cw=1200, ch=800) // 0.15 → 180px

// px 结果喂给 render 层
render({ parent: stage, node: px[0], tokens })
```

三步走完。没有额外架构要求。
