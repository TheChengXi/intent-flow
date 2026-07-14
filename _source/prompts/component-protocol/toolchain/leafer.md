# Leafer UI — 渲染引擎

**2D Canvas 场景图渲染引擎。如需 3D，建议切换为 Three.js 等引擎，或混合使用。（协议层与换算层无需改动。）**

## 选型理由

- 场景图（Scene Graph）天然匹配递归组件树
- 协议里的每个组件节点可直接映射为 `Group` / `Leaf`
- `identity` → `LeaferNode.id`
- `slots` → `Group.add(child)`
- 官方宣称 1.5 秒创建 100 万个节点，协议拆再细也不怕
- `@leafer-ui/animate` 支持协议中定义的 motion 轨迹参数

## 在架构中的角色

`renderer/leafer/` 是整个架构中**唯一引用 Leafer 的地方**。core、converter、layout 都不 import Leafer。

替换引擎时只需替换 `renderer/` 目录下的实现，core 层和协议层完全不动。

## 替换为其他引擎

将 Leafer 替换为 Three.js（3D）或原生 Canvas 时：

| 目录/文件 | 需要改 | 不需要改 |
|-----------|--------|---------|
| renderer/leafer/scene.ts | ✅ 渲染逻辑完全重写 | — |
| renderer/leafer/layout.ts | ⚠️ 布局算法可能需调整 | — |
| renderer/leafer/components/ | ✅ 组件渲染逻辑重写 | — |
| core/ | ❌ | 状态/行为不变 |
| converter/ | ❌ | 换算逻辑不变 |
| protocol/ | ❌ | 协议定义不变 |

## 常见坑点

### Text 文本居中

Leafer 的 Text 支持 `textAlign: 'center'`，它是**相对于元素自身的 x 坐标居中**，不是相对于父容器。

```typescript
// ❌ 错误：手动估算偏移，文本一换就不准
parent.add(new Text({ x: cx - 100, text: '能力地图', textAlign: 'center' }))

// ✅ 正确：x 设为中心点，textAlign 自动居中
parent.add(new Text({ x: cx, text: '能力地图', textAlign: 'center' }))
```

x 直接设为画布/容器宽度的一半即可，不需要减半个文本宽度。

### 垂直布局用相对顺序，别写死 y

多个元素上下排列时，不要给每个元素写死 y 坐标：

```typescript
// ❌ 错误：固定 y 值，增删元素要全部重算
parent.add(new Text({ x: cx, y: cy - 80, ... }))  // 图标
parent.add(new Text({ x: cx, y: cy - 20, ... }))  // 标题
parent.add(new Text({ x: cx, y: cy + 15, ... }))  // 描述

// ✅ 相对顺序：用一个 cursorY 变量累加
let y = cy - totalH / 2
parent.add(new Text({ x: cx, y, ... }))       // 图标
y += 48 + gap
parent.add(new Text({ x: cx, y, ... }))       // 标题
y += 24 + gap
parent.add(new Text({ x: cx, y, ... }))       // 描述
```

这样增删元素或调间距时，后面的自动跟着位移，不用重算任何 y 值。

### 交互元素用 Group 包裹，避免文字挡住图形

Leafer 的 Text 节点即使没有绑定事件，也会覆盖在下方图形上，拦截命中检测。
如果事件绑在图形上、文字盖在图形上方，点击文字区域时事件会被吞掉。

```typescript
// ❌ 错误：文字盖住按钮，点击文字区域事件丢失
const btn = new Rect({ x: 0, y: 0, width: 160, height: 36 })
parent.add(btn)
parent.add(new Text({ x: 80, y: 18, text: '选择文件夹', textAlign: 'center' }))
btn.on('pointer.down', () => { ... })  // 点文字没反应

// ✅ 正确：按钮和文字包在 Group 里，事件绑在 Group 上
const g = new Group({ x: 0, y: 0 })
g.add(new Rect({ x: 0, y: 0, width: 160, height: 36 }))
g.add(new Text({ x: 80, y: 18, text: '选择文件夹', textAlign: 'center' }))
parent.add(g)
g.on('pointer.down', () => { ... })  // 点按钮任何位置都触发
```

原则：**涉及交互的元素，把图形和文字包进同一个 Group，事件绑在 Group 上。**

## 渲染方式选择建议

这套架构不限制渲染方式，同一组件内可以混用 DOM 和 Canvas：

| 适合 DOM | 适合 Canvas |
|---------|------------|
| 静态引导界面（空状态、加载） | 复杂场景图（树、图、节点连线） |
| 简单按钮、输入框、表单 | 大量图形元素需要高性能绘制 |
| 需要原生平台交互反馈的元素 | 需要频繁重绘的动态布局 |
| 文本排版复杂的区域 | 场景缩放、拖拽、动画 |

**示例**：组件目录下可以同时存在两种渲染实现：

```
components/empty-state/
├── render.ts          ← Canvas 渲染（可选，复杂场景用）
├── EmptyState.vue     ← DOM 渲染（简单交互用）
└── protocol.ts        ← 协议定义（共享）
```

原则：**需要用交互的用 DOM，需要用性能的用 Canvas。** 两者通过 App.vue 的 v-if + CSS 显隐切换，互不干扰。
