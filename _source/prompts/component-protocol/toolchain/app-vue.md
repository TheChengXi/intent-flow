# Vue 3 — 运行时容器

**选它不是因为 UI 渲染需要用 Vue，而是因为要它的 HMR。**

- HMR 热更新：改代码不刷新页面，保留组件运行时状态
- reactive 系统：天然可观察的数据容器，对应协议的 RuntimeSnapshot
- 生命周期管理：onMounted / onUnmounted 控制场景图的挂载与销毁

## App.vue 只做一件事

**页面根组件分发。** 不写业务逻辑，不放状态管理，不绑事件。

```vue
<template>
  <CapabilityMap />
</template>
```

只做全局样式地基（CSS reset、html/body 100% 撑满）。

## 页面层（pages/）接管运行时职责

App.vue 将所有职责下放给具体的页面编排组件（`pages/*/`），每个页面独立持有：

| 能力 | 归属 |
|------|------|
| onMounted / onUnmounted 生命周期 | 页面编排组件（如 CapabilityMap.vue） |
| reactive 数据容器（对应 state.ts） | core/capability-map/state.ts |
| ResizeObserver → 调度渲染 | 页面编排组件（onMounted 中注册） |
| VS Code 消息通信 | core/capability-map/state.ts |
| 主题切换触发重渲染 | 页面编排组件 → composable: scheduleRender() |

## 页面编排组件的标准结构

每个页面（`pages/<name>/`）一般包含：

- `<Name>.vue` — template + 生命周期编排
- `composable.ts` — 胶水层，连接 core 与 renderer（可选，简单页面可合并到 .vue 中）

## 主题切换

VS Code 的 light/dark 主题切换通过 CSS 变量（`--vscode-*`）驱动。`readToken()` 在每次 `scheduleRender()` 中**动态读取**当前 CSS 变量值，因此主题切换后只需触一发 `scheduleRender()` 即可自动更新颜色。

```typescript
scheduleRender()  // tokens 会自动重新读取
```

不需要额外的 onThemeChange 流程。ResizeObserver 和主题切换共用 `scheduleRender()` 入口。
