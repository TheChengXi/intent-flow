# 02 — 交互行为约定（Behavior Contract）

## 1. 总则

**每个组件节点自洽地定义自己的交互行为。** 组件不跨层操作其他组件的交互逻辑——交互只发生在自己内部。

所谓"交互"，不是事件绑定，而是**状态迁移的公开描述**。

## 2. 行为定义的组成

每个组件节点可以声明三样东西：

```yaml
BehaviorContract:
  stateMachine:              # 状态机
    states: State[]          # 所有可能状态
    transitions: Transition[] # 状态迁移规则

  actions: Action[]          # 外部可触发的动作

  motion?: MotionParams      # 动作执行时的运动轨迹参数
```

## 3. 状态机

### 3.1 状态

```yaml
State:
  name: string               # 状态名，如 "idle"、"dragging"、"hover"
  description?: string       # 语义说明
```

通用状态约定（组件应按需选用）：

| 状态 | 说明 |
|------|------|
| `idle` | 默认静止态 |
| `hover` | 鼠标悬停（非触摸设备） |
| `focus` | 键盘/焦点进入 |
| `active` | 被激活/按下 |
| `dragging` | 正在被拖拽 |
| `disabled` | 不可交互 |
| `loading` | 等待数据 |
| `error` | 异常状态 |

### 3.2 迁移

```yaml
Transition:
  from: string               # 起始状态
  to: string                 # 目标状态
  trigger: string            # 触发源："user" | "data" | "system"
  via?: string               # 触发动作名
```

示例—一个可拖拽组件：

```yaml
stateMachine:
  states:
    - name: "idle"
    - name: "hover"
    - name: "dragging"
    - name: "dropped"
  transitions:
    - from: "idle"
      to: "hover"
      trigger: "user"
      via: "pointerEnter"
    - from: "idle"
      to: "dragging"
      trigger: "user"
      via: "dragStart"
    - from: "hover"
      to: "dragging"
      trigger: "user"
      via: "dragStart"
    - from: "dragging"
      to: "dropped"
      trigger: "user"
      via: "drop"
    - from: "dropped"
      to: "idle"
      trigger: "system"
      via: "reset"
    - from: "dragging"
      to: "idle"
      trigger: "user"
      via: "cancel"
```

## 4. 动作（Actions）

动作是**外部（AI / 用户 / 测试脚本）对组件发起操作的接口**。

```yaml
Action:
  name: string               # 动作名，如 "move"、"toggle"、"zoom"
  description?: string       # 语义说明
  input: Schema              # 入参结构
  output: Schema             # 返回值结构（纯数据，不含 UI）
  effects:
    - type: "state"          # 改变状态
      target: string         # 目标状态
    - type: "motion"         # 触发运动
      target?: string        # 运动参数名（引用 MotionParams）
    - type: "emit"           # 向外发事件
      target: string         # 事件名
```

### 4.1 动作的输入输出必须是纯数据

```yaml
# ✅ 合法：输入输出都是可序列化的结构
- name: "move"
  description: "将组件移动指定偏移"
  input:
    dx: { type: "number", unit: "px", description: "水平位移量" }
    dy: { type: "number", unit: "px", description: "垂直位移量" }
  output:
    x: { type: "number", description: "移动后的 x 坐标" }
    y: { type: "number", description: "移动后的 y 坐标" }

# ❌ 不合法：不能输出 DOM 引用、组件实例、渲染树
- name: "move"   # 不能返回 this.$el / ref / vnode
```

### 4.2 常见动作类型

| 动作类别 | 例子 | 输入 | 输出 |
|---------|------|------|------|
| 位移 | `move`, `moveTo`, `drag` | `{dx, dy}` 或 `{x, y}` | `{x, y}` |
| 开关 | `toggle`, `open`, `close` | 无 / `{to: boolean}` | `{status: "on" | "off"}` |
| 缩放 | `zoom`, `zoomTo` | `{level}` 或 `{scale}` | `{level, scale}` |
| 数值调整 | `increase`, `decrease` | `{delta}` | `{value}` |
| 重置 | `reset`, `cancel` | 无 | `{state: "idle"}` |
| 提交 | `submit`, `confirm` | `{payload}` | `{result, error?}` |

## 5. 运动轨迹参数

当动作触发时，组件可以声明如何运动（动效参数）。

```yaml
MotionParams:
  type: "transition" | "animation" | "spring" | "tween"
  duration: string           # 持续时长，如 "300ms"
  easing: string             # 缓动曲线，如 "ease-out"、"cubic-bezier(0.4, 0, 0.2, 1)"
  displacement:              # 位移描述
    unit: "px" | "%" | "auto"
    x?: string               # 水平位移量表达式
    y?: string               # 垂直位移量表达式
  properties?: string[]      # 其他动画属性，如 ["opacity", "transform"]
```

### 5.1 运动参数也是数据

和动作的输入输出一样，运动参数是**可序列化的纯数据**，不是 CSS 代码。

```yaml
# ✅ 合法：纯数据
- action: "drag"
  motion:
    type: "spring"
    duration: "auto"     # 基于位移量动态计算
    easing: "ease-out"
    displacement:
      unit: "px"
      x: "{dx}"          # 引用动作输入的 dx 值
      y: "{dy}"          # 引用动作输入的 dy 值

# AI 可以直接读这些参数，而不需要解析 CSS
```

### 5.2 运动参数引用规则

- 用 `{paramName}` 引用动作输入的字段值
- 用 `{state.*}` 引用组件的当前状态值
- 不支持运行时动态表达式（保持可计算性）

## 6. 完整示例：一个可拖拽卡片

```yaml
identity: "page.card-1"
type: "draggable-card"

# ── 状态机 ──
stateMachine:
  states:
    - name: "idle"
    - name: "dragging"
    - name: "dropped"
  transitions:
    - from: "idle"     to: "dragging"  trigger: "user"  via: "dragStart"
    - from: "dragging"  to: "dropped"   trigger: "user"  via: "drop"
    - from: "dropped"   to: "idle"      trigger: "system" via: "reset"
    - from: "dragging"  to: "idle"      trigger: "user"  via: "cancel"

# ── 动作 ──
actions:
  - name: "dragStart"
    input:
      pointerX: { type: "number", description: "指针起始 x" }
      pointerY: { type: "number", description: "指针起始 y" }
    output:
      state: { type: "dragging" }
    effects:
      - type: "state"
        target: "dragging"

  - name: "move"
    input:
      dx: { type: "number", unit: "px" }
      dy: { type: "number", unit: "px" }
    output:
      x: { type: "number" }
      y: { type: "number" }
    effects:
      - type: "motion"
        target: "dragMotion"

  - name: "drop"
    input: {}
    output:
      x: { type: "number" }
      y: { type: "number" }
      state: { type: "dropped" }
    effects:
      - type: "state"
        target: "dropped"

# ── 运动轨迹 ──
motion:
  dragMotion:
    type: "spring"
    duration: "auto"
    easing: "ease-out"
    displacement:
      unit: "px"
      x: "{dx}"
      y: "{dy}"
```

## 7. 约束规则（行为必须满足）

```
约束清单
──────────────────────────
① 所有状态必须在 stateMachine.states 中声明
② 所有迁移必须引用已声明的状态
③ 动作的 input/output 必须是可 JSON 序列化的类型
④ 运动参数的 displacement 不能写死具体值（必须引用动作输入或状态）
⑤ 一个组件不能直接触发另一个组件的状态迁移
⑥ 动作 output 不包含 DOM 引用、组件实例、渲染上下文
⑦ 状态迁移的 trigger 只能取值 "user"、"data"、"system" 之一
