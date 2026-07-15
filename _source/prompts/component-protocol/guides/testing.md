# 测试策略

## 测试哲学

| 测什么 | 不测什么 |
|-------|---------|
| 纯函数 + 可隔离的逻辑 | 依赖渲染引擎实例的代码 |
| 状态变更行为（action → state） | UI 视觉效果（人类验收制） |
| 布局计算结果 | Canvas 绘制结果 |
| 数据转换管线（% → px） | Vue 组件交互细节 |

## 需要测试的

### converter/（换算层）— 纯函数

输入容器尺寸 + 百分比 → 输出 px。没有副作用，不依赖任何外部环境。

```ts
test('宽度 50% = 容器一半', () => {
  expect(convertWidth('50%', { cw: 1000 })).toBe(500)
})

test('所有输出 >= 0', () => {
  // 可做属性测试：随机百分比 + 随机容器尺寸
})
```

**价值：** 锁住"百分比 → px"的换算逻辑，改代码时不会算错。

### layout/（布局算法）— 纯计算

输入原始数据 + 容器尺寸 → 输出坐标树。不涉及渲染。

```ts
test('文件夹下文件纵向排列', () => {
  const tree = layout(fixtureData, { cw: 1200, ch: 800 })
  expect(tree[0].y + tree[0].h).toBeLessThanOrEqual(tree[1].y as number)
})
```

**价值：** 布局计算影响所有节点的位置，错了整个地图是乱的。

### core/capability-map/state.ts（响应式状态）

`invokeAction` 按预期修改状态。不 mock、不跑浏览器。

```ts
test('toggleExpand 切换折叠状态', () => {
  invokeAction('toggleExpand', { identity: 'folder-1' })
  expect(state.expanded['folder-1']).toBe(true)
  invokeAction('toggleExpand', { identity: 'folder-1' })
  expect(state.expanded['folder-1']).toBe(false)
})
```

### pretext.ts（文本测量）

输入 label + font → 输出精确宽度。影响布局准确性。

```ts
test('文本宽度计算', () => {
  const w = measureNaturalWidth('Hello', { fontSize: 14, fontFamily: 'sans-serif' })
  expect(w).toBeGreaterThan(0)
})
```

### core/capability-map/behavior.ts（XState 状态机）

XState 官方提供 `@xstate/test` 自动生成用例，覆盖所有合法迁移路径。

```ts
test('从 idle 经过 drag 到达 dragging', () => {
  // 由 @xstate/test 自动遍历状态机
})
```

## 可以测但不需要的

以下技术仅在此列出，以拓展认知。本项目暂无需引入。

### @vue/test-utils + jsdom

这是 Vue 生态的标准组件测试方案。在 Node 中模拟浏览器环境（jsdom），挂载 Vue 组件，断言渲染结果。

```ts
import { mount } from '@vue/test-utils'
import Toolbar from './Toolbar.vue'

test('点击展开按钮触发 action', async () => {
  const wrapper = mount(Toolbar)
  await wrapper.find('button').trigger('click')
  // 断言 state 变化
})
```

**为什么本项目不需要：**

| 文件 | 内容 | 交互逻辑 | 需要测吗 |
|------|------|---------|---------|
| overlay/toolbar/Toolbar.vue | 按钮布局 | 只调 invokeAction | ❌ |
| overlay/info-panel/InfoPanel.vue | 纯展示 | 只读 state | ❌ |
| overlay/empty-state/EmptyState.vue | 纯展示 | 静态内容 | ❌ |
| overlay/toast/Toast.vue | 纯展示 | 定时消失 | ❌ |
| overlay/map-tools/MapTools.vue | 按钮布局 | 只调 invokeAction | ❌ |
| overlay/path-indicator/PathIndicator.vue | 纯展示 | 只读 state | ❌ |

你的业务逻辑在 core/ 和 converter/ 里，Vue 组件层只是薄薄一层胶水，没有需要组件测试验证的交互逻辑。加了 `@vue/test-utils` 只是多一个依赖和更长的测试时间。

## 不用测试的

| 目录 | 原因 |
|------|------|
| renderer/leafer/scene.ts | 重度依赖 Leafer Canvas 实例，mock 环境等于没测 |
| renderer/leafer/components/*/render.ts | 纯 Canvas 绘制操作，无逻辑断言 |
| pages/capability-map/composable.ts | 胶水代码，测它等于要跑集成测试 |
| pages/capability-map/CapabilityMap.vue | 页面组装，无独立业务逻辑 |

## 工具链

| 工具 | 用途 |
|------|------|
| Vitest | 测试运行器。原生支持 TypeScript，速度比 Jest 快 |
| @xstate/test | 从状态机自动生成测试用例（可选） |
| fast-check | 属性测试，自动生成随机输入（可选，转换层可用） |

### 运行

```bash
# 安装
npm install -D vitest

# 运行所有测试（只测纯函数的话毫秒级完成）
npx vitest run

# 开发时监听
npx vitest
```

## 不做的

- 不写端到端测试（E2E），Leafer Canvas 渲染结果依赖 GPU 驱动
- 不测 UI 视觉效果（人类审美验收制）
- 不测 Vue 组件交互（无独立业务逻辑）
