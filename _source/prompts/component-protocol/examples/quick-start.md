# 快速启动

三步上手。

## 1. 定义协议

```
engine/components/button/protocol.ts

export const css = {
  width: '15%',
  height: '5%',
  proportions: [3, 1],  // 按钮保持 3:1 比例
}
```

## 2. 实现渲染

```
engine/components/button/render.ts

import { Rect } from 'leafer-ui'
import type { RenderContext } from '../types'

export function render(ctx: RenderContext) {
  const { parent, node, tokens } = ctx
  const rect = new Rect({
    width: node.w,
    height: node.h,
    fill: tokens.primary,
    cornerRadius: [4],
  })
  parent.add(rect)
}
```

## 3. 挂载到 App.vue

```
src/adapter/vscode/ui/webview/src/App.vue

onMounted(() => {
  app = new Leafer({ view: canvasRef.value })
  buildScene({ app, data, tokens: readToken(), cw: 800, ch: 600 })
})
```

## 实际项目结构

```
src/adapter/vscode/ui/webview/src/
  ├── App.vue              # 100% 地基 + HMR + 生命周期
  ├── main.js              # 入口
  └── engine/              # 运行时
      ├── converter/       # 02 换算层：% → px 纯函数
      ├── layout/          # 纯布局算法
      └── components/      # 组件目录，每个目录自洽
          ├── capability-map/  # 编排组件：state + behavior + render
          ├── folder/          # 协议组件：protocol + render
          ├── group/           # 协议组件：protocol + render
          └── file/            # 协议组件：protocol + render
```
