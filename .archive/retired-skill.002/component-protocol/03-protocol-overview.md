# 协议总览

组件协议族由三份子协议构成，递进定义了一个 UI 组件的完整契约。

```
01 静态结构 ──── 组件树长什么样（递归嵌套）
       │
       ▼
02 交互行为 ──── 每个组件怎么动（状态机 + 动作 + 运动参数）
       │
       ▼
03 运行时数据 ── 运行中的数据如何被外部读取（快照 + dryRun）
```

---

## 01 — 静态结构约定（Static Structure）

### 核心思想

一个 UI 页面是一棵**递归的组件树**。每个节点是一个组件，节点内部可以包含子节点。没有独立的"页面层"或"布局层"——页面本身也是一个组件。

### 节点格式

```yaml
ComponentNode:
  identity: string          # 树内唯一标识，如 "page.map.speed-gauge"
  type: string              # 组件类型名，如 "navigation-bar"、"gauge"
  props: Prop[]             # 数据接口
    - name: string          # prop 名
      type: string          # 类型描述
      kind: "structural" | "content"
                            # structural = 结构参数
                            # content = 文案/文本占位
      required: boolean
      default?: any
  slots: Slot[]             # 子节点插槽
    - name: string
      cardinality: "0-1" | "0-n" | "1-n"
      accepts?: string[]    # 允许的子组件 type 列表
  css: CSSSkeleton          # CSS 骨架（百分比 + token）
    width: string           # 如 "60%", "100%"
    height?: string
    tokens: string[]        # 如 ["primary", "bg"]
```

### 内容/结构分离

```yaml
# ✅ 合法：AI 只声明这里需要文案，不写具体内容
- name: "title"
  type: "string"
  kind: "content"
  description: "仪表盘标题"

# ❌ 不合法：把具体文案写死在结构定义中
- name: "title"
  kind: "content"
  default: "欢迎来到我的仪表盘"   # 具体文案不应出现在结构定义里
```

### 约束清单

```
① 树必须有且只有一个根节点
② 每个节点 identity 在树内唯一
③ props 中 required 的字段，父组件必须提供
④ 子节点 type 必须匹配父节点 slots.accepts（如有约束）
⑤ CSS 不允许固定 px（边框线宽除外）
⑥ 颜色只引用 token，不引用具体色值
⑦ 容器组件不越界操作子组件的内部状态
⑧ content 类 props 不得携带具体业务文案作为 default
⑨ content 类 props 必须由外部注入，组件不自生产文案
```

### 物理组织形式

协议节点 `type` 字段直接映射为代码目录。每个组件类型一个独立目录，自洽管理自己的协议、渲染和行为。

```
engine/components/<type-name>/
├── index.ts        # re-export 三文件
├── protocol.ts     # 组件协议：尺寸百分比 + props + slots
├── render.ts       # 渲染逻辑：Leafer 场景图（2D，可替换）
└── behavior.ts     # 交互行为：XState 状态机（可选）
```

#### 文件职责

**protocol.ts** — 组件协议的 TypeScript 表示
- identity（固定值，如 `'component://folder'`）
- css 中的宽高百分比（遵循约束清单⑤，不允许固定 px）
- 可选 `proportions` 声明组件的自然比例（如 `[4, 1]` 表示宽:高 = 4:1），支持 N 维，设定后对应维度不再独立计算
- 不 import 任何框架，纯 TS 定义

**render.ts** — 组件的可视化
- 接收统一 `RenderContext`，内含 parent / node / tokens / invokeAction
- 只画自己节点对应的场景图子树
- import `leafer-ui`
- 不关心数据从哪来、不读其他组件的状态

**behavior.ts** — 组件的交互逻辑
- XState `createMachine()` 定义 states / transitions / actions
- import `xstate`
- 组件状态迁移由自己驱动，不跨组件触达

#### 尺寸来源流程

协议中的百分比不在 render.ts 中直接使用，而是由 Converter 层统一换算为 px：

```
protocol.ts（8% / 10%）
    ↓
Converter 在运行时根据容器 px 尺寸换算
    ↓
render.ts 读取 node.w / node.h（已转为 px）
    ↓
Leafer 场景图接收到 px 坐标，无需百分比感知
```

这样一来，render.ts 永远只处理 px 值，协议永远只写百分比，Converter 是两者之间唯一的桥接层。

---

## 02 — 交互行为约定（Behavior Contract）

### 核心思想

每个组件节点**自洽地定义自己的交互行为**。组件不跨层操作其他组件的交互逻辑——交互只发生在自己内部。

所谓"交互"，不是事件绑定，而是**状态迁移的公开描述**。

### 行为定义

```yaml
BehaviorContract:
  stateMachine:
    states: State[]          # 所有可能状态
    transitions: Transition[] # 状态迁移规则
  actions: Action[]          # 外部可触发的动作
  motion?: MotionParams      # 动作执行时的运动轨迹参数
```

### 状态

通用状态约定（组件按需选用）：

| 状态 | 说明 |
|------|------|
| `idle` | 默认静止态 |
| `hover` | 鼠标悬停（非触摸） |
| `focus` | 焦点进入 |
| `active` | 被激活/按下 |
| `dragging` | 正在被拖拽 |
| `disabled` | 不可交互 |
| `loading` | 等待数据 |
| `error` | 异常状态 |

### 迁移

```yaml
Transition:
  from: string       # 起始状态
  to: string         # 目标状态
  trigger: string    # "user" | "data" | "system"
  via?: string       # 触发动作名
```

### 动作

动作是外部（AI / 用户 / 测试脚本）对组件发起操作的接口。

```yaml
Action:
  name: string
  input: Schema           # 入参（必须可 JSON 序列化）
  output: Schema          # 返回值（必须可 JSON 序列化）
  effects:
    - type: "state"       # 改变状态
    - type: "motion"      # 触发运动
    - type: "emit"        # 向外发事件
```

### 运动轨迹参数

```yaml
MotionParams:
  type: "transition" | "animation" | "spring" | "tween"
  duration: string       # 如 "300ms"
  easing: string         # 如 "ease-out"
  displacement:
    unit: "px" | "%" | "auto"
    x?: string           # 如 "{dx}" 引用动作输入
    y?: string
```

### 约束清单

```
① 所有状态必须在 stateMachine.states 中声明
② 所有迁移必须引用已声明的状态
③ 动作的 input/output 必须是可 JSON 序列化的类型
④ 运动参数的 displacement 不能写死具体值（必须引用动作输入或状态）
⑤ 一个组件不能直接触发另一个组件的状态迁移
⑥ 动作 output 不包含 DOM 引用、组件实例、渲染上下文
⑦ 状态迁移的 trigger 只能取值 "user"、"data"、"system" 之一
```

---

## 03 — 运行时数据契约（Runtime Data Schema）

### 核心思想

一个组件在运行时必须能够向外部暴露它的**当前状态**和**可接受的动作**。

协议定义"暴露什么"，不定义"怎么暴露"——HTTP、WebSocket、MCP、内存共享都可以。

### 代码载体

运行时数据契约在代码中对应的载体是 **`state.ts`**：

```
state.ts（组件自行通信时选用）
──────────────────────
reactive state     → RuntimeSnapshot 中的 props / position
操作函数           → ActionInterfaceSnapshot 中的 availableActions
invokeAction 入口  → 动作执行调度
VS Code 消息监听   → 外部数据驱动的状态更新
```

**与 behavior.ts 的分工：**
```
behavior.ts（02 交互行为）          state.ts（03 运行时数据）
────────────────────              ────────────────────
用户交互 → 状态迁移               外部消息 → 数据更新
idle → dragging → idle            rootData / expanded / cache
XState 引擎执行                    Vue reactive 驱动
```

**适用规则：** 组件是否需要 state.ts 取决于它是否需要自行与外部通信。没有固定类别。

### 运行时快照

```yaml
RuntimeSnapshot:
  identity: string              # 与静态结构一致
  type: string
  state:
    name: string                # 当前状态机状态
    since: number               # 进入此状态的时间戳
  props: Record<string, any>    # 当前 props 实际值
  position:
    x, y, width, height: number # 运行时坐标（px）
  motion:
    isAnimating: boolean
    currentMotion?: string
    progress?: number
  children: string[]            # 子组件 identity 列表
```

### 动作接口快照

```yaml
ActionInterfaceSnapshot:
  identity: string
  availableActions:             # 当前状态下可触发的动作
    - name: string
      input: Schema
      output: Schema
  constraints:                  # 当前约束
    - action: string
      params: { dx: { min, max } }
```

### dryRun — AI 先跑一遍

这是整个协议最核心的设计。

```yaml
# AI 的验证流程：
# Step 1: 模拟动作
result = component.dryRun("move", { dx: -5, dy: 0 })
# 返回: { x: 95, y: 200 }（纯数据，不触发渲染）

# Step 2: 验证返回值
assert(result.x == expectedX)

# Step 3: 验证通过，通知真实执行
component.invokeAction("move", { dx: -5, dy: 0 })
# 此时才触发状态迁移 + 运动轨迹 + UI 渲染
```

**dryRun 不触发 UI 渲染，不触发运动动效。** 它只返回纯数据。

### 轨迹历史

```yaml
TrajectoryRecord:
  history:
    - action: string
      input: Record<string, any>
      output: Record<string, any>
      state: { from, to }
      timestamp: number
      motion: { duration, path }   # 关键帧路径
  constraints:
    maxLength: 100                 # FIFO 淘汰
```

### 外部读写接口

```yaml
RuntimeContract:
  read:
    getSnapshot: () => RuntimeSnapshot
    getActionInterface: () => ActionInterfaceSnapshot
    getTrajectory: (since?: number) => TrajectoryRecord[]
    getComponent: (identity: string) => RuntimeSnapshot | null

  write:
    invokeAction: (name: string, input: Record) => Record

  verify:
    dryRun: (name: string, input: Record) => Record  # 无副作用
```

### 约束清单

```
① 运行时快照的所有字段必须可 JSON 序列化
② dryRun 不能产生副作用（不改变状态、不触发渲染、不触发动画）
③ invokeAction 的返回值必须与对应 action.output 定义一致
④ 轨迹历史最多保留 100 条（可配置，默认 FIFO）
⑤ 轨迹历史中的 path 关键帧至少包含起点和终点
⑥ getSnapshot 在任何状态下都必须返回数据（不允许 null）
⑦ 组件不可访问其他组件的内部状态
```
