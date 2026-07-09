# 01 静态结构：组件协议定义

协议维度。定义组件长什么样：节点结构、CSS 骨架、属性、插槽。
协议的具体存储格式由实现者自定（TS 接口 / YAML / JSON / 结构体），以下用 TS 接口做示例说明。

> **当前实现以 TS 接口为准。** YAML / JSON 等格式为可选项，不作强制。当前无 YAML → TS 自动生成工具链，协议定义直接在 `protocol.ts` 中以 TS 类型和变量声明编写。

## 组件节点（ComponentNode）

```typescript
interface ComponentNode {
  type: string           // 组件类型标识，如 'folder', 'file'
  identity: string       // 唯一标识 URI
  css: CSSSkeleton       // CSS 骨架（百分比 + token）
  props: Props           // 组件接受的属性
  slots: Slot[]          // 子组件插槽列表
}
```

### identity

所有协议组件都应拥有全局唯一的 identity。

格式：`component://${type}/${shortId}`

例：`component://folder/3a8f`、`component://file/1b2c`

shortId 由父组件在构建节点时分配（或由 converter 自动生成），不需要人工指定。

### css：CSSSkeleton

```typescript
interface CSSSkeleton {
  width: string          // 百分比（如 '15%'）或 'auto'
  height: string         // 百分比（如 '5%'） 或 'auto'
  left?: string          // 百分比偏移（可选）
  top?: string           // 百分比偏移（可选）
  tokens: TokenBinding[] // 颜色等 token 绑定
  proportions?: number[] // 自然比例（可选），如 [4, 1] 宽:高 = 4:1
                         // 设定后对应维度不再独立计算，支持 N 维
}
```

- 所有尺寸使用百分比，不写死 px
- tokens 颜色值来源为 5 主色 token 体系
- 比例（proportions）优先级高于独立宽高

### props

```typescript
interface Props {
  kind: "structural" | "content"  // 结构组件 / 内容组件
  accepts: string[]               // 可接受的子组件 type 列表
  // 其他自定义字段（随组件类型变化）
}
```

- `kind: structural` → 容器/布局类组件，自身不产生内容
- `kind: content` → 实际展示内容的组件

### slots

```typescript
interface Slot {
  name: string         // 插槽名称
  type: string         // 接受的子组件 type
  css: CSSSkeleton     // 子组件在当前插槽的尺寸约束
}
```

### props 传递

父组件通过 slot 的 children 数组中的每个节点携带完整 props。
换算层不处理 props，渲染层通过 `node.props` 读取后再传给子组件渲染器：

```
父 render 层
  └── 读取 children[i].props
      └── 传给子组件 render(ctx) 的 ctx 中
          └── 子组件通过 node.props 读取
```

## 文本节点

文本节点可作为一种标准组件类型存在：

```typescript
const textNode = {
  type: "text",
  css: {
    width: "100%",       // 文本节点必须指定宽度（百分比），才能计算高度
    height: "auto",      // 高度由文字内容撑开
  },
  props: {
    textContent: string,
    textFont: string,
    textLineHeight: number,
  }
}
```

> **`width: auto` 的当前范围：** 仅用于文本节点（高度由文字撑开）。
> 非文本节点的 `auto` 不在当前协议范围内。
> 如果一个容器组件需要由子节点撑开尺寸，需要引入弹性布局（Flex-like），当前阶段不做处理。

## 映射关系（当前示例）

以下展示协议概念在当前 demo 实现中的代码映射，不是强制规定。

| 协议维度 | 抽象映射 | 当前示例 |
|----------|---------|---------|
| ComponentNode.type | → 组件目录名 | `components/<type-name>/` |
| ComponentNode.identity | → 运行时由父组件或页面注入 | — |
| ComponentNode.css | → 尺寸百分比定义 | `protocol.ts` |
| ComponentNode.slots | → 渲染层容器节点 | `render.ts` 中用场景图 Group 容纳 |
| ComponentNode.props | → 属性定义 | `protocol.ts` |

## 基础设施职责

| 职责 | 抽象描述 | 当前示例 |
|------|---------|---------|
| 渲染容器基底 | 提供画布 / 视口 | App.vue 中的 100% div |
| 主题色读取 | 从运行环境读取 color token | `readToken()` |
| 组件组装 + 编排 | 初始化 + 动作调度 + 渲染触发 | App.vue 的 onMounted / invokeAction / scheduleRender |
