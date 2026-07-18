# XState — 状态机引擎

**选它不是因为它"轻"，而是因为它"完整"。**

| 需求 | XState 解决 |
|------|------------|
| 状态迁移 | `send(event)` → 自动匹配当前状态的合法迁移 |
| 非法事件 | 内置处理，不会走到未定义状态 |
| 历史记录 | `inspect()` 追踪每次迁移 |
| TypeScript 推导 | 状态类型、事件类型全推导 |
| 可视化调试 | Stately 可视化工具查看状态机运行 |
| 测试工具 | `@xstate/test` 生成测试用例 |

## 为什么不自写

协议场景下，状态机配置由 AI 生成 YAML 再转成 XState 格式。人类不手写状态机代码，XState 再多的 API 也不增加人类负担。而边界情况、类型推导、调试工具这些，自己写一套的成本远超收益。

## 在架构中的角色

behavior.ts 是整个架构中**唯一引用 XState 的地方**。

```ts
// 示例（以 Vue 为例）
import { useActor } from '@xstate/vue'
import { dragMachine } from './behavior'

const { snapshot: dragSnapshot, send: dragSend } = useActor(dragMachine)

dragSend({ type: 'DRAG_START' })
dragSnapshot.value.matches('dragging')  // true / false
```
