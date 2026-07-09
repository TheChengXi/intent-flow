# 架构总览

## 分层架构

整个系统分五层，自底向上：

```
┌──────────────────────────────────────────────────────────┐
│                    ① 协议定义层                           │
│    YAML 协议文件（组件树 + 行为契约 + 数据契约）           │
│    由 AI 生成，人类审核                                   │
├──────────────────────────────────────────────────────────┤
│                    ② 换算层                               │
│    Converter ── 纯函数，协议 % CSS → 运行时 px 坐标       │
│    框架无关 / 协议无关 / 输入相同输出一定相同              │
├──────────────────────────────────────────────────────────┤
│                    ③ 运行时管理层                           │
│    App.vue ── 100% div 地基 + HMR + 生命周期控制           │
│    Vue 3 (reactive + HMR) ── 数据容器                     │
│    XState ── 状态机执行引擎                                │
├──────────────────────────────────────────────────────────┤
│                    ④ 数据计算层                             │
│    Pretext ── 纯数据文字排版计算（零 DOM 回流）              │
│    Converter 提供的 px 坐标作为文字排版布局的基础           │
├──────────────────────────────────────────────────────────┤
│                    ⑤ 渲染执行层                             │
│    Leafer UI ── Canvas 场景图（Group / Leaf 树）          │
│    每个协议节点映射为场景图节点                             │
└──────────────────────────────────────────────────────────┘
```

## 数据流

```
AI 生成 YAML 协议
        │
        ▼
   Zod 校验（约束清单检查）
        │
        ▼
   代码生成器拆成三路
   ┌─────────────┐  ┌──────────┐  ┌──────────────┐
   │ 组件树骨架    │  │ 状态机定义 │  │ 运行时数据定义 │
   │(identity,    │  │(states,  │  │(props 默认值, │
   │ props,       │  │ transitions│  │ 快照格式)    │
   │ slots,       │  │ actions) │  │              │
   │ css %)       │  │          │  │              │
   └──────┬───────┘  └────┬─────┘  └──────┬───────┘
          │               │               │
          ▼               │               │
    ┌──────────────┐      │               │
    │  Converter    │      │               │
    │  % CSS → px  │      │               │
    │  递归换算     │      │               │
    └──────┬───────┘      │               │
          │               │               │
          ▼               ▼               ▼
     Leafer 场景图    XState 实例       Vue reactive
     (Group/Leaf)    (状态迁移引擎)     (纯数据容器)
          │               │               │
          │         ┌─────┘               │
          │         ▼                     │
          │    dryRun ──── 纯函数计算 ───┘
          │         │
          │         ▼ (验证通过)
          │    invokeAction
          │         │
          └─────────┘
          ▼
     Leafer update() → 屏幕渲染
```

## 各层职责

### 协议定义层（AI 产出）

- 组件树的递归结构（identity / type / props / slots / css）
- 每个组件自洽的状态机（states / transitions / actions）
- 运行时数据的接口契约（snapshot / dryRun / invokeAction）
- 内容/结构分离（content 类 props 只留占位，不写具体文案）

### 换算层（Converter）

- 纯函数 `convertTree(compiledRoot, cw, ch) → Map<id, PxBounds>`
- 将协议中的百分比 CSS 换算为运行时 px 坐标
- 递归遍历：父组件的 px 边界 = 子组件的容器基准
- 不引入任何框架（Vue / Leafer / XState），只做数学运算
- Pretext 文本高度计算作为可选插件注入

### 运行时管理层（Vue + XState）

- Vue 3 的 reactive 系统作为数据容器
- XState 执行状态迁移，提供 `send()` / `subscribe()`
- Vite HMR 提供开发时的热更新体验
- Vue 生命周期（onMounted / onUnmounted）控制 Leafer 场景图的挂载与销毁
- ResizeObserver + rAF 节流控制换算触发的时机

### 数据计算层（Pretext + dryRun）

- Pretext 两阶段排版：`prepare()` 预处理 → `layout()` 纯算术
- 所有文字排版计算不触碰 DOM，不走浏览器 reflow
- dryRun 模拟动作执行，只算数据不触发渲染

### 渲染执行层（Leafer UI）

- Canvas 场景图，递归 Group/Leaf 树
- 支持百万级节点，适合协议拆到极细的原子组件风格
- 仅在 `invokeAction` 确认后才执行 `update()` 重绘

## 组件的物理组织方式

每个组件类型在代码中对应一个独立目录。目录结构直接反映协议结构。

### 目录结构

```
engine/components/<type-name>/
├── index.ts        # 统一出口，re-export
├── protocol.ts     # 01 静态结构：组件协议定义
│                   #   identity / css / props / slots
│                   #   尺寸用百分比，不写死 px
│                   #   可选：proportions 声明组件的自然比例
│                   #     如 [4, 1] 即宽:高 = 4:1
│                   #     支持 N 维（如 3D：[4, 1, 2]）
│                   #   设定后对应维度不再独立计算
├── render.ts       # 04 渲染执行：Leafer 场景图（可选，可膨胀为目录）
│                   #   接受 RenderContext
│                   #   只画自己的节点，不跨组件操作
├── behavior.ts     # 02 交互行为：XState 状态机（可选，可膨胀为目录）
│                   #   states / transitions / actions
└── state.ts        # 03 运行时数据：reactive + 外部通信（可选，可膨胀为目录）
                    #   组件有自行通信需求时使用
                    #   否则数据由父组件通过 props 传入
```

### 单向膨胀：文件 → 目录

protocol.ts / render.ts / behavior.ts / state.ts 是四个**维度**，不是四个**文件**。
以文件起步，当维度逻辑膨胀到难以维护在一个文件中时，可直接升格为目录：

```
# 文件态
button/render.ts

# 目录态（对外接口不变，调用方无感知）
button/render/
├── index.ts      # 对外暴露，签名与原 render.ts 一致
├── base.ts       # 基础绘制
├── hover.ts      # 悬停特效
└── ripple.ts     # 点击波纹
```

```
# 文件态
button/behavior.ts

# 目录态
button/behavior/
├── index.ts      # 暴露主状态机
├── machine.ts    # XState 定义
├── guards/       # 守卫条件
│   ├── auth.ts
│   └── cooldown.ts
└── actions/      # 副作用
│   ├── submit.ts
│   └── feedback.ts
```

**规则：** 向外暴露的签名不变，目录内的拆分对外完全透明。
调用方（index.ts 或其他组件）永远只 import 维度根路径。

### 角色是两个概念，不是两个类型

组件的目录里**有什么文件，就有什么能力**。没有预设的

一个目录可以有任意组合的 protocol / behavior / state / render。

- 有 `protocol.ts` → 组件有自定尺寸，受协议约束，可被外部协议引用
- 有 `behavior.ts` → 组件有独立交互行为（XState 状态机）
- 有 `state.ts` → 组件自行与外部通信（reactive + VS Code 消息）
- 有 `render.ts` → 组件参与渲染场景图

**没有两个固定的桶。每个组件只含它需要的文件。**

同一个组件也可以在演变中增加或移除文件。目录不负责分类，文件清单负责声明能力。

编排 是一个概念，不是一种类型。当一个组件持有 `state.ts` 并协调其他组件的渲染流程时，它在当前上下文中扮演编排角色。协议 也是一个概念——当一个组件以 `protocol.ts` 定义自己的尺寸和接口并在多个场景中被引用时，它在扮演协议角色。

### 映射关系

```
协议维度                   代码文件
──────────────────────────────────────
ComponentNode.type         → components/<type-name>/
ComponentNode.identity     → 运行时由父组件或页面注入
ComponentNode.css          → protocol.ts 中的尺寸百分比
ComponentNode.slots        → render.ts 中用 Leafer Group 容纳
ComponentNode.props        → protocol.ts 中的 props 定义
BehaviorContract           → behavior.ts 中的 XState machine
MotionParams               → behavior.ts 中的动作参数
RuntimeSnapshot            → state.ts 中的 reactive state（组件自行持有时）
                           │ 或由父组件 props 传递
ActionInterfaceSnapshot    → state.ts 中的操作函数
dryRun / invokeAction      → state.ts 中的调用入口（由 render 或组件页面调度）

基础设施                   代码位置
──────────────────────────────────────
100% div 地基 + HMR       → App.vue（template 中的 canvas 容器）
主题色读取                 → App.vue 中的 readToken()
组件组装 + 页面编排         → App.vue 中的 onMounted / invokeAction / scheduleRender
```

### 职责边界

| 文件 | 协议层 | 该管的 | 不该管的 |
|------|--------|--------|---------|
| `protocol.ts` | 01 静态结构 | 组件多大、接受什么 props、有什么 slots | 具体渲染坐标、交互逻辑 |
| `render.ts` | 04 渲染执行 | 组件怎么画到 Leafer 上、响应式动效 | 数据来源、业务状态 |
| `behavior.ts` | 02 交互行为 | 状态迁移规则、action 定义 | 渲染细节、组件尺寸、业务数据 |
| `state.ts` | 03 运行时数据 | reactive state、外部消息通信、操作函数 | 状态迁移规则、渲染逻辑 |

### 技术栈如何实现自洽

每个组件目录中的文件，由不同的技术栈负责实现，互不越界：

```
protocol.ts（01 静态结构）   render.ts（04 渲染执行）      behavior.ts（02 交互行为）      state.ts（03 运行时数据）
─────────────────────      ──────────────────          ────────────────────          ──────────────────────
只是数据                  Vue 实例化生命         XState 定义状态机        Vue reactive 数据容器
不 import 任何框架        周期、注册事件         不 import Leafer         VS Code 消息通信
纯 TS 类型定义            import Leafer          import 'xstate'          import 'vue'
                          import protocol.ts     import protocol.ts      不 import Leafer / XState
```

**behavior.ts 与 state.ts 的分工界限：**

| behavior.ts | state.ts |
|-------------|----------|
| 用户交互触发的状态迁移（idle→dragging） | 外部数据驱动的状态变更（消息→rootData） |
| 只描述状态间的关系，不持有业务数据 | 持有完整的业务数据（rootData、expanded） |
| 由 XState 引擎执行，可验证、可追溯 | 由 Vue reactive 驱动，响应式更新渲染 |

**文件选择参考：**

| 当前上下文 | 可能需要 state.ts？ | 原因 |
|----------|----------------|------|
| 协调多个子组件、直接与外部通信（如 capability-map） | ✅ | 持有编排所需的数据和通信入口 |
| 只做布局聚合，不持有数据 | ❌ | 数据由父组件传入 |
| 有自定尺寸、可被协议引用存在（如 folder/group/file） | ❌ | 不自持状态，尺寸由 protocol.ts 定义 |
| 需要独立交互行为（拖拽、动画） | ❌ | 由 behavior.ts 处理，不需要 state.ts |
| 需要批量渲染或内存数据快照 | ✅ | 自行管理数据生命周期 |

| 技术 | 在组件自洽中的角色 |
|------|-------------------|
| **Vue** | 提供 `onMounted` / `onUnmounted` 控制生命周期
| | reactive 作为组件数据容器（state.ts）
| | `ResizeObserver` 感知容器尺寸变化，触发换算
| | 为 state.ts 提供 VS Code 消息通信的运行时环境 |
| **XState** | `createMachine()` 定义组件的 states/transitions/actions
| | `@xstate/vue` 的 `useActor()` 连接状态机与 Vue reactive
| | 状态迁移由组件自身驱动，不依赖外部 |
| **Leafer** | `render.ts` 中构建 Group / Leaf 场景图
| | 组件只操作自己的场景子树
| | 不读取其他组件的状态或数据
| | ⚠ 2D 渲染引擎。如需 3D，建议切换为 Three.js 等 3D 引擎，
| |   或与 Leafer 混合使用（协议层与 render.ts 接口不变） |
| **Converter** | `protocol.ts` 中的百分比 → 运行时 px
| | 纯函数，不绑定任何框架
| | 可在组件 render 之前或 dryRun 阶段调用 |

这种组织方式确保：**从文件夹层面就能看出这是什么组件、它多大、怎么画、有什么行为。**

```
协议组件                  Leafer 场景图
─────────────────────────────────────────
根节点 page              App ｜ Stage
  ├─ 容器组件            ├─ Group
  │   ├─ 子容器          │   ├─ Group
  │   └─ 协议子组件      │   └─ Leaf (Rect/Text/Image)
  ├─ 协议子组件          ├─ Leaf
  └─ 文字占位            └─ Pretext.layout() 计算尺寸
```

## 关键设计决策

| 决策 | 理由 |
|------|------|
| 不自己写热更新 | Vite 团队数年打磨，一个人写投入产出比负数 |
| 不自己写状态机 | XState 处理了边界情况、可视化、历史追踪、类型推导 |
| 协议 = YAML | AI 天生适合生成结构化 YAML，人类可读 |
| Vue 只当容器 | 不写 template DOM，只提供 reactive + 生命周期 |
| Leafer 管渲染 | Canvas 场景图天然匹配递归组件树 |
| Pretext 管排版 | 纯数据计算，不触发 DOM reflow，可在 dryRun 阶段完成 |
| **Converter 是纯函数层** | % → px 换算与框架解耦，可在 Node/Worker/浏览器任意环境运行 |
| **组件以目录为单位自洽** | protocol/render/behavior/state 四文件各自管各自的维度，改一个组件只进一个目录 |
