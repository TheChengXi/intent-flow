# 数据流向

## 核心流程

```
容器尺寸变化（resize / 初始化）
        │
        cw, ch
        ▼
dryRun('resize', { width, height })
        │  纯函数验证，不修改任何状态
        ▼
invokeAction('resize')  或  直接调 convertTree
        │
        ▼
converter.convertTree(compiled, cw, ch)
        │  所有百分比 → px
        ▼
render 消费 px 坐标，更新画面
```

## 关键契约

### dryRun ↔ invokeAction

- `dryRun` 是纯函数**不得修改任何内部状态**
- `invokeAction` 可在验证通过后改变状态并触发渲染
- 相同输入下 `dryRun` 返回值 === `invokeAction` 返回值

### Converter ↔ Render

- Converter 输出的是纯 px 数据：`{ w, h, left, top }`
- Render 只消费 px 值，不关心来源是百分比还是固定值
- Converter 无渲染上下文依赖，可在 Node / Worker / 浏览器任意环境运行

## 多渲染层通信规则

如果项目中同时使用多个渲染层（如 DOM overlay + Canvas 场景图），两者应**不直接通信**，通过共享状态中介：

```
DOM 组件（按钮点击）
  → invokeAction('toggle')
  → state 变更
  → Canvas 监听到状态变化 → 重绘

Canvas（拖拽）
  → invokeAction('drag')
  → state 变更
  → DOM 监听到状态变化 → UI 更新
```

**核心规则：**
- DOM 不直接调 Canvas 的方法
- Canvas 不直接操作 DOM 的响应式数据
- 两者只通过 state 中介交流
