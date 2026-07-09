# 数据流向

## 核心流程：一次 resize 的完整生命周期

```
ResizeObserver 捕获容器尺寸变化
        │
        cw, ch
        ▼
dryRun('resize', { width, height })
        │
        │ 纯函数验证，不修改任何状态
        │ 返回 { cw, ch } 或裁剪后的合法值
        ▼
invokeAction('resize')
        │
        │ 确认通过后：将尺寸传入 converter
        ▼
converter.convertTree(compiled, cw, ch)
        │
        │ 所有百分比 → px
        ▼
buildScene({ app, mapLayer, ... })
        │
        │ 接收 px 坐标，更新场景图
        ▼
Leafer 渲染
```

## 关键契约

### dryRun ↔ invokeAction

- `dryRun` 是纯函数**不得修改任何内部状态**
- `invokeAction` 可在验证通过后改变状态并触发渲染
- 相同输入下 `dryRun` 返回值 === `invokeAction` 返回值

### Converter ↔ Render

- Converter 输出的是纯 px 数据：`{ w, h, left, top }`
- Render 只消费 px 值，不关心来源是百分比还是固定值
- Converter 无渲染上下文依赖，可在 Node / Worker / 浏览器任意环境运行

## 一次 resize 的代码映射

```
App.vue
├── ResizeObserver → onResize
├── dryRun('resize', { w, h })
│   └── 验证尺寸合法性（proportions 等）
├── invokeAction('resize')
│   └── 触发 scheduleRender()
└── buildScene()
    ├── convertTree(compiled, cw, ch)
    │   ├── compileNode()   —— 解析百分比字符串
    │   ├── resolveText()   —— Pretext 测量文本高度
    │   └── convertNode()   —— 递归换算每个节点
    ├── calcSubtreeWidth()  —— 计算子节点撑起的实际宽度
    ├── layoutNode()        —— 分配 x, y 位置
    └── Leafer.Group 更新
```

> 图中 Leafer 标注为 2D 渲染引擎。如需 3D，可切换为 Three.js 等引擎，或混合使用。
> 协议层与换算层无需改动，仅替换 `render.ts`。
