# 03 运行时数据：运行时契约

协议维度。定义运行时的数据结构和动作调度契约：数据怎么流、动作怎么验证和执行。
以下用通用数据描述，不绑定具体数据容器实现。

## 运行时快照

```typescript
interface RuntimeSnapshot {
  identity: string                    // 组件唯一标识
  type: string                        // 组件类型
  state: string                       // 当前行为状态
  props: Record<string, any>          // 当前属性值
  children: RuntimeSnapshot[]         // 子组件快照
}
```

## 动作接口

```typescript
interface ActionInterfaceSnapshot {
  availableActions: Action[]
  currentState: string       // 当前行为状态
}

interface Action {
  name: string               // 动作标识
  input: Record<string, any> // 输入参数（JSON 可序列化）
  output: Record<string, any> // 输出结果（JSON 可序列化）
}
```

所有动作输入输出均可 JSON 序列化，保证可模拟、可验证。

## dryRun / invokeAction 契约

- `dryRun(name, payload)` — 纯函数，模拟动作执行但不修改状态。返回值 = 如果执行了会得到什么结果
- `invokeAction(name, payload)` — 执行动作。先调 dryRun 验证，通过后修改状态并触发渲染
- dryRun 不得改变任何内部状态
- 相同输入下 dryRun 的返回值 === invokeAction 的返回值

## 适用规则

组件是否需要独立的运行时数据层，取决于它是否需要自行与外部通信，没有固定类别。

| 当前上下文 | 可能需要数据层？ | 原因 |
|-----------|----------------|------|
| 协调多个子组件、直接与外部通信 | ✅ | 持有编排所需的数据和通信入口 |
| 只做布局聚合，不持有数据 | ❌ | 数据由父组件传入 |
| 有自定尺寸、可被协议引用 | ❌ | 不自持状态，尺寸由协议定义 |
| 需要独立交互行为 | ❌ | 由行为契约处理 |
| 需要批量渲染或内存数据快照 | ✅ | 自行管理数据生命周期 |

## 典型交互序列

以下展示一次用户操作在 state / behavior / render 之间的一般流程：

```
用户点击展开图标
       │
       ▼
behavior: 状态机迁移到 'expanded'
       │
       ▼
dryRun('toggleExpand', { path })    ← 纯函数验证
       │
       ▼
invokeAction('toggleExpand', { path })
       │
       ├── state: 更新 expanded 中的 path
       │
       └── scheduleRender()
               │
               ├── convertTree()        ← 百分比重新换算
               ├── buildScene()          ← 场景图更新
               └── 渲染引擎绘制        ← 屏幕刷新

外部消息
       │
       ▼
state: 更新 rootData
       │  （不触发状态机）
       │
       └── watch 检测到 → scheduleRender()
```

**两条独立路径：**
- 用户交互 → behavior 驱动 → state 部分更新
- 外部消息 → state 直接更新 → 不走 behavior

这两条路径是抽象的业务流程，具体实现中数据容器的响应机制、渲染触发的调度方式均可替换。
