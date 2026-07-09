# 技术选型

## 选型总览

| 层级 | 工具 | 版本 | 用途 |
|------|------|------|------|
| 开发环境 | Vite + Vue 3 | ^6 | 热更新 + reactive 响应式数据 |
| 状态机 | XState | ^5 | 组件行为的状态迁移引擎 |
| 渲染引擎 | Leafer UI | latest | Canvas 场景图渲染 |
| 文字排版 | Pretext | latest | 纯数据文本排版计算 |
| 结构校验 | Zod | ^3 | 协议 YAML 的运行时校验 |
| 开发语言 | TypeScript | ^5 | 类型安全 |

---

## 逐项选型理由

### Vite + Vue 3 — 开发环境容器

**选它不是因为 UI 渲染需要用 Vue，而是因为要它的 HMR。**

- HMR 热更新：改代码不刷新页面，保留组件运行时状态
- reactive 系统：天然可观察的数据容器，对应协议的 RuntimeSnapshot
- 生命周期管理：onMounted / onUnmounted 控制 Leafer 场景图的挂载与销毁
- 不需要 Vue template 做 DOM 渲染，template 里只放一个 canvas 容器 div

> 自己写热更新？Vite 团队全职打磨了数年，一个人重现投入产出比完全负数。

---

### XState — 状态机执行引擎

**选它不是因为它"轻"，而是因为它"完整"。**

| 需求 | XState 解决 |
|------|------------|
| 状态迁移 | `send(event)` → 自动匹配当前状态的合法迁移 |
| 非法事件 | 内置处理，不会走到未定义状态 |
| 历史记录 | `inspect()` 追踪每次迁移 |
| TypeScript 推导 | 状态类型、事件类型全推导 |
| 可视化调试 | Stately 可视化工具查看状态机运行 |
| 测试工具 | `@xstate/test` 生成测试用例 |

**为什么不自写：**

协议场景下，状态机配置由 AI 生成 YAML 再转成 XState 格式。人类不手写状态机代码，XState 再多的 API 也不增加人类负担。而边界情况、类型推导、调试工具这些，自己写一套的成本远超收益。

> 市面那么多人都选择用别人写好的状态机库而不自己写，不是因为懒，是因为别人写了几年的库确实更好用、更稳定、底层优化更到位。

---

### Leafer UI — 渲染引擎

**选它是因为场景图（Scene Graph）天然匹配递归组件树。**

- 协议里的每个组件节点可直接映射为 `Group` / `Leaf`
- `identity` → `LeaferNode.id`
- `slots` → `Group.add(child)`
- 官方宣称 1.5 秒创建 100 万个节点，协议拆再细也不怕
- `@leafer-ui/animate` 支持协议中定义的 motion 轨迹参数


---

### Pretext — 文字排版计算

**选它是因为"纯数据计算，零 DOM 回流"。**

- `prepare(text, font)` — 一次性预处理，分词 + 测量 + 缓存（1-5ms）
- `layout(prepared, width)` — 纯算术算高度/行数（0.0002ms）
- 不调用 `getBoundingClientRect` / `offsetHeight`，不走 browser reflow
- 可渲染到 DOM / Canvas / SVG，与 Leafer 无冲突

**为什么需要它：**

Leafer UI 是 Canvas 渲染。Canvas 的原生 `measureText` 只支持单行文本。要做多行换行、文字绕排、动态高度计算，要么自己实现要么用 Pretext。

Pretext 的"两阶段设计"与协议的 dryRun 理念一致——`prepare()` 相当于预编译，`layout()` 相当于纯函数计算，可以在不触发渲染的阶段完成排版计算。

---

### Zod — 协议结构校验

- 递归 Schema 定义（`z.lazy()`）对应协议的递归组件树
- `.refine()` 实现跨字段约束检查（如"子节点 type 匹配父节点 accepts"）
- 运行时校验 + TypeScript 类型推导二合一
- AI 生成的 YAML 在落地为代码前，先过 Zod 校验拦截非法结构

---

## 完整链路一览

```
AI 生成 YAML 协议
        │
   Zod 校验（结构合法性）
        │
   代码生成器
   ├── 组件树 → Leafer 场景图
   ├── 状态机 → XState machine
   ├── 数据   → Vue reactive
   └── 文字   → Pretext prepare()
        │
   dryRun（纯函数验证，不渲染）
        │
   invokeAction（验证通过后执行）
        │
   Leafer update() → 屏幕
```
