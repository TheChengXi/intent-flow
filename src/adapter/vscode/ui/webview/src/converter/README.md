# 换算层 — Converter

将协议树中的百分比值递归换算为像素坐标。

## 定位

```
协议层（百分比）         换算层（纯函数）         渲染层（px）
                                                
YAML 协议树 ──→ convertTree() ──→ Map<id, PxBounds> ──→ Leafer 场景图
                   ↑
             containerBounds
          （来自 100% div 的 getBoundingClientRect）
```

## 核心原则

1. **纯函数** — 无副作用，输入相同输出一定相同
2. **递归** — 父组件的 px 边界 = 子组件的容器基准
3. **框架无关** — 不 import Vue / Leafer / 任何框架
4. **协议无关** — 只认 `ComponentNode` 结构，不关心上层业务
