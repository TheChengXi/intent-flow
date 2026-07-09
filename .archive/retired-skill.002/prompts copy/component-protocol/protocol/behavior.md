# 02 交互行为：状态机契约

协议维度。定义组件怎么动：状态迁移、触发事件、运动参数。
状态机的具体实现引擎由实现者自定，以下用通用状态机概念做说明。

## 行为契约

```typescript
interface BehaviorContract {
  states: State[]            // 状态列表
  initial: string            // 初始状态名
  transitions: Transition[]  // 迁移规则
}
```

### state

```typescript
interface State {
  name: string               // 状态名称，如 'idle', 'dragging', 'hovered'
  type: "atomic" | "compound" | "parallel"
}
```

### transition

```typescript
interface Transition {
  from: string | string[]    // 源状态名（支持多源）
  event: string              // 触发事件名
  to: string                 // 目标状态名
  guard?: string             // 守卫条件（可选）
  action?: string            // 执行动作（可选）
  motion?: MotionParams      // 运动参数（可选）
}
```

### motion（运动参数）

```typescript
interface MotionParams {
  duration: number           // 持续时长（ms）
  easing: string             // 缓动曲线 ID
  displacement: {            // 位移参数
    x?: string               // 百分比或变量引用，如 '{dx}' 或 '-10%'
    y?: string               // 同上
    scale?: number           // 缩放倍率
  }
}
```

- motion 参数中的变量（如 `{dx}`）来源于动作输入的字段
- 所有位移值在渲染层通过 converter 换算为 px

## 职责边界

| 行为契约管 | 不管 |
|-----------|------|
| 状态迁移规则（states/transitions） | 渲染细节 |
| action 定义 | 组件尺寸 |
| 守卫条件 | 业务数据 |
| 运动参数声明 | 数据来源 |

## 行为契约与运行时数据的分工

| 行为契约 | 运行时数据 |
|---------|-----------|
| 用户交互触发的状态迁移（idle→dragging） | 外部数据驱动的状态变更（消息→rootData） |
| 只描述状态间的关系，不持有业务数据 | 持有完整的业务数据 |
| 由状态机引擎执行，可验证、可追溯 | 由数据容器驱动，响应式更新渲染 |

## 当前实现示例

| 维度 | 当前示例 |
|------|---------|
| 状态机引擎 | XState（`createMachine()`） |
| 代码文件 | `behavior.ts` |
| Vue 集成 | `useActor()` 桥接状态机到响应式系统 |
| 运动参数执行 | 渲染层通过 converter 换算后驱动 |

状态机引擎可替换为其他实现（如 C 中的手工状态表、Rust 中的 match + enum），只要遵循 states / transitions / motion 的契约格式即可。
