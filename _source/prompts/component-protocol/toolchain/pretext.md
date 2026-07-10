# Pretext — 文本测量与布局库

**纯数据文本测量布局库。2.8k stars，React 核心成员 Cheng Lou 开发，Midjourney 生产验证。**

## 选型理由

- 绕过 DOM 测量（无 `getBoundingClientRect`/`offsetHeight`），纯算术算排版
- 单次 `prepare()` 预处理，`layout()` 为纯算术热路径，适合频繁重排场景
- 支持多语言、双向文本、字素分割、平台表情符号
- 与协议 `dryRun` 理念一致：`prepare` 相当于预编译，`layout` 相当于纯函数计算

## 接口

```typescript
// 基础：测量文本高度（用于撑大节点、布局计算）
import { prepare, layout } from '@chenglou/pretext'

const p = prepare('文本', '12px sans-serif')
const { height, lineCount } = layout(p, maxWidth, lineHeight)

// 手动排版（逐行获取，适合 Canvas 逐行绘制）
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'

const p2 = prepareWithSegments('文本', '12px sans-serif')
const { lines } = layoutWithLines(p2, maxWidth, lineHeight)
```

## 统一预处理入口

`resource/text/index.ts` 提供统一的 `prepareText(text, font)` 缓存函数：

```typescript
import { prepareText } from '../resource/text'

const prepared = prepareText('能力地图', '14px sans-serif')
// 后续 layout() 纯算术，0.0002ms
```

相同文本+字号只 prepare 一次，缓存命中后直接复用。组件不需要自己管理 prepare 时机。

## 接入情况

| 组件 | 使用方式 | 作用 |
|------|---------|------|
| resource/text/index.ts | 统一 prepare 缓存 | 所有文本资源的预处理入口 |
| capability-map/layout.ts | `preprocessNodes()` + `measureNaturalWidth()` | 动态文本（文件名/组名）的精确宽度测量 |
| connection-line（待接入） | `prepareText` + `layoutWithLines` | 线上浮动文本排版 |
| folder（render） | `textWrap: false` Leafer 自撑 | 文件夹标签无需约束宽度 |
| file（render） | `textWrap: false` Leafer 自撑 | 文件标签无需约束宽度 |
