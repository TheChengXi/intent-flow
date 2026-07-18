# 测试策略

## 测试哲学

| 测什么 | 不测什么 |
|-------|---------|
| 纯函数 + 可隔离的逻辑 | 依赖渲染引擎实例的代码 |
| 状态变更行为（action → state） | UI 视觉效果（人类验收制） |
| 布局计算结果 | Canvas / DOM 绘制结果 |
| 数据转换管线（% → px） | 组件交互细节（无独立逻辑时） |

## 需要测试的

### Converter（换算层）— 纯函数

输入容器尺寸 + 百分比 → 输出 px。没有副作用，不依赖任何外部环境。

```ts
test('宽度 50% = 容器一半', () => {
  expect(convertWidth('50%', { cw: 1000 })).toBe(500)
})

test('所有输出 >= 0', () => {
  // 可做属性测试：随机百分比 + 随机容器尺寸
})
```

### 布局算法 — 纯计算

输入原始数据 + 容器尺寸 → 输出坐标树。不涉及渲染。

```ts
test('子节点在父节点内纵向排列', () => {
  const tree = layout(fixtureData, { cw: 1200, ch: 800 })
  expect(tree[0].y + tree[0].h).toBeLessThanOrEqual(tree[1].y as number)
})
```

### 状态逻辑

`invokeAction` 按预期修改状态。不 mock、不跑浏览器。

```ts
test('toggleExpand 切换折叠状态', () => {
  invokeAction('toggleExpand', { identity: 'node-1' })
  expect(state.expanded['node-1']).toBe(true)
  invokeAction('toggleExpand', { identity: 'node-1' })
  expect(state.expanded['node-1']).toBe(false)
})
```

### 状态机

状态机引擎（如 XState）提供自动遍历工具，覆盖所有合法迁移路径。

```ts
test('从 idle 经过 drag 到达 dragging', () => {
  // 由状态机测试工具自动遍历
})
```

## 不用测试的

- 依赖渲染引擎实例的代码（mock 环境等于没测）
- 纯渲染/绘制操作（无逻辑断言）
- 胶水代码、页面组装代码（无独立业务逻辑）
- UI 视觉效果（人类验收制）
- 端到端测试（渲染结果依赖 GPU 驱动）

## 工具链参考

| 工具 | 用途 |
|------|------|
| Vitest / Jest | 测试运行器 |
| 状态机测试工具（@xstate/test 等） | 从状态机自动生成测试用例 |
| fast-check | 属性测试，自动生成随机输入（推荐用于换算层） |

### 运行

```bash
npx vitest run    # 运行所有测试（纯函数毫秒级完成）
npx vitest        # 开发时监听
```
