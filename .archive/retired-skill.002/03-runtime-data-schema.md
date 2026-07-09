# 03 — 运行时数据契约（Runtime Data Schema）

## 1. 总则

一个组件在运行时必须能够向外部暴露它的**当前状态**和**可接受的动作**。

这份契约定义的是"暴露什么"，不定义"怎么暴露"——HTTP、WebSocket、MCP、内存共享都可以，那是执行端的事。

## 2. 运行时快照

每个组件节点在任意时刻，外部可以读取到一份结构化的状态快照：

```yaml
RuntimeSnapshot:
  identity: string              # 组件 identity（与静态结构一致）
  type: string                  # 组件 type
  state:                        # 当前状态机的状态
    name: string                # 如 "idle"、"dragging"
    since: number               # 进入此状态的时间戳（ms）
  props: Record<string, any>    # 当前 props 的实际值
  position:                     # 当前布局位置（运行时坐标）
    x: number                   # px 值（相对父容器）
    y: number                   # px 值（相对父容器）
    width: number               # px 值
    height: number              # px 值
  motion:                       # 当前运动状态
    isAnimating: boolean        # 是否正在动画中
    currentMotion?: string      # 正在执行的动作名
    progress?: number           # 动画进度 [0, 1]
  children: string[]            # 子组件的 identity 列表
```

## 3. 动作接口快照

运行时不仅要暴露状态，还要暴露"你可以对我做什么"：

```yaml
ActionInterfaceSnapshot:
  identity: string
  availableActions:             # 当前状态下可触发的动作
    - name: string              # 动作名
      input: Schema             # 入参格式
      output: Schema            # 返回值格式
    - name: string
      ...
  constraints:                  # 当前状态下能做的动作有啥限制？
    - action: string            # 动作名
      params:
        dx: { min: -500, max: 500 }   # 约束：可移动区间
        dy: { min: -500, max: 500 }
```

### 3.1 动作接口的描述格式

```yaml
ActionSchema:
  name: string
  description?: string
  input:
    - name: string
      type: string
      required: boolean
      default?: any
      constraints?:            # 运行时可变的约束
        min?: number
        max?: number
        enum?: any[]
  output:
    - name: string
      type: string
```

## 4. 轨迹历史

运行时还应该维护一份**运动轨迹记录**，可供外部追溯：

```yaml
TrajectoryRecord:
  identity: string
  history:
    - action: string            # 什么动作
      input: Record<string, any> # 当时的输入
      output: Record<string, any> # 当时的输出
      state:
        from: string            # 动作前的状态
        to: string              # 动作后的状态
      timestamp: number         # 执行时间
      motion?:                  # 运动细节
        duration: number        # 实际耗时（ms）
        path:                   # 关键帧路径
          - { t: 0,    x: 100, y: 200 }
          - { t: 0.5,  x: 102, y: 200 }
          - { t: 1,    x: 105, y: 200 }
```

### 4.1 轨迹记录的容量约束

```yaml
TrajectoryConstraints:
  maxLength: 100                # 最多保留 100 条记录
  retention: "FIFO"             # 超限时淘汰最老记录
  idleCompaction: true          # 闲置时可压缩（丢弃中间帧，只保留关键帧）
```

## 5. 外部读写接口（协议层定义）

协议不定义传输方式，但定义**接口形态**——任何执行端都必须满足这个契约：

```yaml
RuntimeContract:
  # ── 读接口（外部 → 组件） ──
  read:
    getSnapshot: () => RuntimeSnapshot
    getActionInterface: () => ActionInterfaceSnapshot
    getTrajectory: (since?: number) => TrajectoryRecord[]
    getComponent: (identity: string) => RuntimeSnapshot | null  # 按 identity 查询

  # ── 写接口（外部 → 组件） ──
  write:
    invokeAction: (actionName: string, input: Record<string, any>) => Record<string, any>
    # 返回值 = 该动作的 output，纯数据

  # ── 验证接口（AI 验证用） ──
  verify:
    # 返回动作执行后的预期结果，供 AI 比对
    dryRun: (actionName: string, input: Record<string, any>) => Record<string, any>
    # 不改变状态，只返回"如果我执行了这个动作会得到什么"
```

### 5.1 `dryRun` 的意义

这是**"AI 先跑一遍"**的关键接口。

```yaml
# AI 的验证流程：
# Step 1: AI 调用 dryRun 模拟动作
result = component.dryRun("move", { dx: -5, dy: 0 })
# 返回: { x: 95, y: 200 }

# Step 2: AI 验证返回值是否符合预期
assert(result.x == expectedX)   # ✅ 纯数据比对

# Step 3: 验证通过，通知真实执行
if verified:
    component.invokeAction("move", { dx: -5, dy: 0 })
    # 此时才触发状态迁移 + 运动轨迹 + UI 渲染
```

**`dryRun` 不触发 UI 渲染，不触发运动动效。** 它只返回纯数据。

## 6. 组件树快照（聚合视图）

外部可以一次性读取整棵组件树的运行时快照：

```yaml
TreeSnapshot:
  root: RuntimeSnapshot
  # 递归：每个 snapshot.children 指向子节点的 snapshot
  
# 也可以按 identity 路径查询子树
subtree: (identity: string) => TreeSnapshot
```

## 7. AI 验证流程（协议层定义）

协议不实现这个流程，但定义**验证必须满足的步骤**：

```yaml
VerificationProtocol:
  # ① 静态验证：检查组件树是否满足静态结构约束
  phase1_static:
    - 所有 identity 不重复
    - props required 字段已填
    - CSS 无 px（边框除外）
    - 颜色只引用 token

  # ② 行为验证：模拟动作，检查返回数据
  phase2_behavior:
    - 对每个声明的 action 调用 dryRun
    - 验证返回值类型匹配 action.output 定义
    - 验证状态迁移符合 stateMachine.transitions

  # ③ 运动验证：检查运动参数是否可计算
  phase3_motion:
    - 所有 {paramName} 引用都能正确绑定到输入值
    - displacement 值在约束范围内
    - duration/easing 是合法值

  # ④ 人审 UI（协议不定义，留给人类）
  phase4_human: "人类看渲染结果 → 决定是否通过"
```

## 8. 约束规则（运行时必须满足）

```
约束清单
──────────────────────────
① 运行时快照的所有字段必须可 JSON 序列化
② dryRun 不能产生副作用（不改变状态、不触发渲染、不触发动画）
③ invokeAction 的返回值必须与对应 action.output 定义一致
④ 轨迹历史最多保留 100 条（可配置，默认 FIFO）
⑤ 轨迹历史中的 path 关键帧至少包含起点和终点
⑥ getSnapshot 在任何状态下都必须返回数据（不允许 null）
⑦ 组件不可访问其他组件的内部状态（只能通过父组件读取 children）
```

## 9. 执行端清单（不为执行端做任何假设）

```
可能的执行端（非穷举）:
  ● AI agent（通过 MCP/HTTP 读数据）
  ● 单元测试框架（直接调用组件实例）
  ● Playwright/Cypress 脚本（通过浏览器 API）
  ● 手动 debug 工具（浏览器 DevTools 插件）
  ● 低代码平台的运行时引擎

协议对以上所有执行端一视同仁——只要满足接口契约即可。
```
