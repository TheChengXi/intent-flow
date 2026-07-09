# 05 Layout：渲染管线的数据格式适配中间件

Layout 不是状态，不是数据，不是渲染。它是渲染管线中的一个**数据格式适配中间件**——在 state 输出到 converter/render 之前，把原始数据整理成协议可消费的格式。

## 定位

完整渲染链路：

```
state（存数据）
  │
  ▼
layout ── 格式适配中间件 ──→ 协议节点树（含 % 尺寸）
  │
  ▼
converter ── % → px
  │
  ▼
render ── 画场景图
```

| 环节 | 管什么 | 特点 |
|------|--------|------|
| **state** | 存储数据，响应变化 | 有状态，持久化 |
| **layout** | 原始数据 → 协议格式 | 无状态，每次重新算，干完就丢 |
| **converter** | % → px 换算 | 全局工具，纯函数 |
| **render** | 画场景图 | 消费 layout 的输出 |

Layout 被 `scheduleRender()` 触发，每次触发时从 state 读当前值，算完即弃。不存任何东西，不画任何东西。

## 跟 converter 的分工

| | converter | layout |
|--|-----------|--------|
| 职责 | 数值单位的转化 | 数据结构的适配 |
| 具体 | % → px | 后端格式 → 协议节点树 |
| 范围 | 全局公用 | 组件私有 |
| 语义 | 无业务语义，纯数学 | 包含业务映射逻辑 |

converter 管的是**单位**，layout 管的是**形状**。

## 什么时候需要 layout

| 条件 | 说明 |
|------|------|
| 接收外部数据 | 数据格式不由协议控制，需要做一次适配 |
| 数据结构不直接映射 | 后端的字段名、层级跟协议定义不一样 |
| 需要动态构建节点树 | 根据数据内容决定创建哪些子节点、赋予什么 css |

## 什么时候不需要 layout

| 条件 | 说明 |
|------|------|
| props 直传 | 子组件数据由父组件通过 props 传入，直接消费 |
| 静态节点 | 节点结构在编码时已确定，不随外部数据变化 |

## 组件集成示例

Layout 放在组件目录下，作为组件私有的中间件：

```
components/capability-map/
├── state.ts        ← 存数据
├── layout.ts       ← 格式适配（state 输出的下一站）
└── render.ts       ← 画图（layout 输出的下一站）
```

Layout 每次调用读 state，不修改 state：

```typescript
// layout.ts
export function calcLayout(state, cw?, ch?) {
  const roots = buildTree(state.rootData, ...)
  applyExpandState(roots, state.expanded, state.cache)
  // 调用布局工具 calcSubtreeWidth / layoutNode 算坐标
  // converter（% → px）由 render.ts 在消费 flatNodes 前统一调用
  return { flatNodes }
}
```
