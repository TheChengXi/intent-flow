# 组件的物理组织方式

每个组件类型在代码中对应一个独立目录。目录结构直接反映协议结构。

## 目录结构

```
components/<type-name>/
├── index.ts        # 统一出口，re-export
├── protocol.ts     # 01 静态结构：组件协议定义
│                   #   identity / css / props / slots
│                   #   尺寸用百分比，不写死 px
│                   #   可选：proportions 声明组件的自然比例
│                   #     如 [4, 1] 即宽:高 = 4:1
│                   #     支持 N 维（如 3D：[4, 1, 2]）
│                   #     设定后对应维度不再独立计算
├── render.ts       # 04 渲染执行（可选，可膨胀为目录）
│                   #   接受 RenderContext
│                   #   只画自己的节点，不跨组件操作
├── behavior.ts     # 02 交互行为：XState 状态机（可选，可膨胀为目录）
│                   #   states / transitions / actions
└── state.ts        # 03 运行时数据（可选，可膨胀为目录）
                     #   组件有自行通信需求时使用
                     #   否则数据由父组件通过 props 传入
```

## 单向膨胀：文件 → 目录

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
    ├── submit.ts
    └── feedback.ts
```

**规则：** 向外暴露的签名不变，目录内的拆分对外完全透明。
调用方（index.ts 或其他组件）永远只 import 维度根路径。

## 当前实际结构

```
src/
├── core/                    # 引擎无关的核心逻辑
│   └── capability-map/      #   state / behavior / types
├── renderer/                # 渲染引擎实现
│   └── leafer/              #   scene / layout / types + components/
│       └── components/      #   folder / group / file / connection-line
├── overlay/                 # Vue DOM 悬浮组件（可选层）
│   ├── toolbar / map-tools / path-indicator /
│   ├── empty-state / info-panel / toast /
├── pages/                   # 页面编排（可选层，单页面可省略）
│   └── capability-map/      #   CapabilityMap.vue + composable
├── converter/               # 换算层（% → px 纯函数）
├── layout/                  # 布局算法
├── resource/                # 文本/主题资源
├── pretext.ts               # 文本测量
├── App.vue                  # 根组件分发
└── main.js                  # 入口
```

> overlay/ 和 pages/ 是推荐但不是强制。overlay 只是 Vue DOM 组件的收容层，不涉及渲染引擎耦合；pages 只在有多个页面时有价值。单页面项目完全可以把所有东西放在同一层。

## 与场景图的映射

```
协议组件                  Leafer 场景图
─────────────────────────────────────────
根节点 page              App ｜ Stage
  ├─ 容器组件            ├─ Group
  │   ├─ 子容器          │   ├─ Group
  │   └─ 协议子组件      │   └─ Leaf (Rect/Text/Image)
  ├─ 协议子组件          ├─ Leaf
  └─ 文字排版            └─ Pretext 输出排版数据
```
