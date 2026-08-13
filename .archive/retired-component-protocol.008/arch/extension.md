# 拓展点架构

Extension Point 不是协议的维度，也不是独立的一层。它是横切五层架构的扩展机制——每层都可以有 Hook 点，供外部能力插入。

## 定位

### 为什么需要拓展点

前端协议/框架只能覆盖约 90% 的场景，剩下 10% 是框架自身无法（或不应）处理的：

- 富文本编辑
- 实时协同
- 跨端差异化逻辑
- 服务端渲染（SSR）
- 表单校验
- 物理效果仿真
- 自定义布局算法
- ……

这些能力不应塞进组件内部逻辑（导致膨胀），也不应替换整层（代价太大），而是通过 Hook 点按需插入。

### 与「层可替换性」的区别

| 维度 | 层可替换（已有） | 拓展点（新增） |
|------|----------------|--------------|
| 粒度 | 替换整层（如 Leafer → Three.js） | 在层的某个阶段插入逻辑 |
| 范围 | 影响整个渲染行为 | 只影响特定动作/节点 |
| 代价 | 高（需实现整层接口） | 低（只实现一个 Hook） |
| 典型场景 | 渲染引擎迁移 | 富文本、协同、校验 |

## Hook 总览

```
 ① 协议定义层    ──  beforeCompile    ← 协议生成后、编译前预处理
                     afterCompile     ← 协议编译后、传给换算层前

 ② 换算层        ──  beforeConvert    ← 换算前调整入参
                     afterConvert     ← 换算结果自定义调整

 ③ 运行时管理层   ──  onDryRun         ← 动作模拟时联动外部验证
                     onInvokeAction   ← 动作执行后触发副作用
                     onResize         ← 容器尺寸变化后介入

 ④ 数据计算层    ──  beforeLayout     ← 排版计算前介入
                     afterLayout      ← 排版结果调整

 ⑤ 渲染执行层    ──  beforeRender     ← 渲染前干预场景图
                     afterRender      ← 渲染完成后同步/记录
```

### 各 Hook 的签名契约

所有 Hook 遵循同一接口模式：

```typescript
type Hook<Input, Output> = {
  name: string              // Hook 标识
  order?: number            // 执行优先级（小优先，默认 0）
  fn: (ctx: HookContext, input: Input) => Output | Promise<Output>
}

type HookContext = {
  identity: string          // 当前组件 identity
  type: string              // 当前组件 type
  stage: string             // 当前阶段名（'beforeConvert' 等）
  abort: (reason?: string) => never  // 中断流程（校验失败时使用）
}
```

| Hook | Input | Output | 说明 |
|------|-------|--------|------|
| beforeCompile | `compiled: ProtocolNode` | `compiled: ProtocolNode` | 可修改协议树 |
| afterCompile | `compiled: ProtocolNode` | `compiled: ProtocolNode` | 协议最终确认 |
| beforeConvert | `{ cw, ch, compiled }` | `{ cw, ch, compiled }` | 可调整容器尺寸 |
| afterConvert | `{ pxTree: PxNode[] }` | `{ pxTree: PxNode[] }` | 可微调换算结果 |
| onDryRun | `{ action, payload, state }` | `{ valid: boolean, reason?: string }` | 返回 false 则阻止动作 |
| onInvokeAction | `{ action, payload, result, state }` | `void` | 执行后副作用，不可回退 |
| onResize | `{ width, height }` | `{ width, height }` | 尺寸变化后调整 |
| beforeLayout | `{ pxNodes: PxNode[] }` | `{ pxNodes: PxNode[] }` | 布局前调整节点 |
| afterLayout | `{ layout: LayoutResult }` | `{ layout: LayoutResult }` | 布局结果后处理 |
| beforeRender | `{ scene: SceneGraph }` | `{ scene: SceneGraph }` | 渲染前修改场景图 |
| afterRender | `{ snapshot: RuntimeSnapshot }` | `void` | 渲染后同步、记录、协同 |

## 示例

### 示例 1：富文本扩展

通过 `onDryRun` Hook 在执行前拦截编辑动作，将编辑态交给富文本引擎处理：

```typescript
registerHook({
  name: 'rich-text-editor',
  stage: 'onDryRun',
  fn: (ctx, { action, payload }) => {
    if (action !== 'editText' || !payload.textNode) return { valid: true }

    // 启动富文本编辑器，接管渲染
    richTextEditor.open(payload.textNode)

    // 阻止默认编辑行为
    return { valid: false, reason: '由富文本引擎接管' }
  }
})
```

### 示例 2：实时协同

通过 `afterRender` Hook 将渲染快照同步到协同服务：

```typescript
registerHook({
  name: 'collaboration-sync',
  stage: 'afterRender',
  order: 100,  // 最后执行
  fn: (ctx, { snapshot }) => {
    collaborationService.broadcast(snapshot)
  }
})
```

### 示例 3：表单校验

通过 `onDryRun` Hook 在校验动作时联动外部校验规则：

```typescript
registerHook({
  name: 'form-validator',
  stage: 'onDryRun',
  fn: (ctx, { action, payload }) => {
    if (action !== 'submit') return { valid: true }

    const errors = validateForm(payload.values)
    if (errors.length > 0) {
      return { valid: false, reason: errors.join('; ') }
    }
    return { valid: true }
  }
})
```

## 实现约定

| 约定 | 说明 |
|------|------|
| **Hook 可组合** | 同一阶段允许多个 Hook 共存，按 `order` 排序执行 |
| **Hook 可中断** | `ctx.abort(reason)` 终止流程，等同该阶段操作失败 |
| **最大 200 行** | 单个 Hook 实现不超过 200 行，超过则拆分为多个 Hook |
| **无侵入** | 不装任何 Hook 时，系统照常运行 |
| **独立包** | 每个拓展应为独立的 npm 包，不依赖协议内部模块 |
