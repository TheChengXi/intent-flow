# Vue 3 — 运行时容器

**选它不是因为 UI 渲染需要用 Vue，而是因为要它的 HMR。**

- HMR 热更新：改代码不刷新页面，保留组件运行时状态
- reactive 系统：天然可观察的数据容器，对应协议的 RuntimeSnapshot
- 生命周期管理：onMounted / onUnmounted 控制 Leafer 场景图的挂载与销毁
- 不需要 Vue template 做 DOM 渲染，template 里只放一个 canvas 容器 div

## Vue 只做两件事

1. **100% div 地基** — App.vue 的 template 中只有一个 div，占满整个视口
2. **热更新** — Vite 提供的 HMR，改代码即生效

其余全交给 Leafer Canvas 渲染。不写 DOM 组件树，不依赖 Vue template 做 UI 组合。

## 角色

| 能力 | 归属 |
|------|------|
| onMounted / onUnmounted 生命周期 | App.vue |
| reactive 数据容器（对应 state.ts） | state.ts |
| ResizeObserver → dryRun → invokeAction | App.vue |
| VS Code 消息通信 | state.ts |
| 主题切换触发重渲染 | App.vue → `scheduleRender()` |

## 主题切换

VS Code 的 light/dark 主题切换通过 CSS 变量（`--vscode-*`）驱动。`readToken()` 在每次 `scheduleRender()` 中**动态读取**当前 CSS 变量值，因此主题切换后只需触一发 `scheduleRender()` 即可自动更新颜色。

```typescript
// 主题变化时（如通过 MutationObserver 或 VS Code 消息）：
scheduleRender()  // tokens 会自动重新读取
```

不需要额外的 onThemeChange 流程。ResizeObserver 和主题切换共用 `scheduleRender()` 入口。
