# 快速启动

## 环境要求

- Node.js >= 20
- pnpm（推荐）或 npm

## 初始化项目

```bash
# 创建项目
npm create vite@latest my-ui-app -- --template vue-ts
cd my-ui-app

# 安装依赖
pnpm add xstate leafer-ui @leafer-ui/animate @leafer-ui/partner
pnpm add @chenglou/pretext
pnpm add zod
```

## 最小原型：一个可拖拽方块

这是最简可运行的例子，跑通整条链路：Vue reactive + Leafer 渲染 + XState 状态机 + dryRun 验证。

### 步骤 1：Vue 组件 — Canvas 容器

```vue
<template>
  <div ref="container" class="w-full h-full" />
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { Leafer, Rect } from 'leafer-ui'
import { createMachine } from 'xstate'

// ── 1. XState 状态机 ──
const machine = createMachine({
  id: 'draggable-box',
  initial: 'idle',
  states: {
    idle: { on: { dragStart: 'dragging' } },
    dragging: { on: { drop: 'dropped', cancel: 'idle' } },
    dropped: { on: { reset: 'idle' } }
  }
})

// ── 2. Vue reactive 数据 ──
const state = reactive({
  current: machine.initialState.value,
  x: 100,
  y: 100,
})

// ── 3. dryRun：纯函数模拟，不触发渲染 ──
function dryRun(action: string, input: Record<string, any>) {
  const next = machine.transition(state.current, action)
  if (action === 'dragStart') return { x: state.x, y: state.y }
  if (action === 'move') return { x: state.x + (input.dx || 0), y: state.y + (input.dy || 0) }
  return {}
}

// ── 4. invokeAction：验证后执行 ──
function invokeAction(action: string, input: Record<string, any>) {
  const result = dryRun(action, input) // dryRun 验证
  const next = machine.transition(state.current, action)
  state.current = next.value
  if (action === 'move') {
    state.x = result.x
    state.y = result.y
    rect.set({ x: state.x, y: state.y }) // 通知 Leafer 更新
  }
}

// ── 5. Leafer 渲染 ──
const container = ref<HTMLDivElement>()
let rect: Rect

onMounted(() => {
  const app = new Leafer({ view: container.value! })
  rect = new Rect({
    x: state.x, y: state.y,
    width: 100, height: 100,
    fill: '#C73E1D',
    draggable: true,
  })
  app.add(rect)

  // Leafer 的拖拽事件 → XState
  rect.on('drag', (e: any) => {
    invokeAction('move', { dx: e.moveX, dy: e.moveY })
  })
  rect.on('drag-end', () => {
    invokeAction('drop', {})
  })
})
</script>
```

### 步骤 2：运行

```bash
pnpm run dev
```

你应该能看到一个红色方块，可以拖拽。控制台可以调用 `dryRun` 验证移动后的坐标，实际拖拽只触发一次渲染更新。

## 下一步

- 将组件树结构改为 YAML 协议驱动（AI 生成 → 解析 → 执行）
- 接入 Pretext 处理文字排版
- 接入 Zod 校验协议结构

## 项目结构参考

以实际项目为例（webview 模块）：

```
src/adapter/vscode/ui/webview/src/
  ├── App.vue              # 100% 地基 + HMR + 生命周期
  ├── main.js              # 入口
  └── engine/              # 运行时
      ├── converter/       # 02 换算层：% → px 纯函数
      │   ├── types.ts
      │   ├── converter.ts
      │   ├── text-resolver.ts
      │   └── index.ts
      ├── layout/          # 纯布局算法
      │   └── index.ts
      └── components/      # 组件目录，每个目录自洽
          ├── capability-map/  # 编排组件：state + behavior + render
          ├── folder/          # 协议组件：protocol + render
          ├── group/           # 协议组件：protocol + render
          └── file/            # 协议组件：protocol + render
```

协议文档同步存放在协议项目的 `_source/prompts/component-protocol/engine/` 下，作为 AI 参考。
