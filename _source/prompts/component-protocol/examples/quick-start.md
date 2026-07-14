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

import { Rect } from 'leafer-ui'
import type { RenderContext } from './types'

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

## 3. 页面集成

```
pages/example/ExamplePage.vue

import { createSceneManager } from '../../renderer/leafer'
const scene = createSceneManager()
scene.createScene(canvasRef.value)
scene.buildScene(tokens, cw, ch)
```

## 当前实际项目结构

```
src/
├── core/                    # 引擎无关核心逻辑
│   └── capability-map/      #   state / behavior / types
├── renderer/                # 渲染引擎（当前为 Leafer）
│   └── leafer/              #   scene / layout + components/
├── overlay/                 # Vue DOM 悬浮组件（可选层）
├── pages/                   # 页面编排（可选层）
│   └── capability-map/      #   CapabilityMap.vue + composable
├── converter/               # 换算层（% → px 纯函数）
├── layout/                  # 布局算法
├── resource/                # 文本/主题资源
├── App.vue                  # 根组件分发
└── main.js                  # 入口
```
