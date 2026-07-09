# 组件协议族

一套面向 AI 生成的 UI 组件协议。定义组件长什么样、怎么动、数据怎么流。

## 索引

```
protocol/
├── arch/                        ← 架构
│   ├── layers.md                ← 五层架构图
│   ├── data-flow.md             ← resize → dryRun → convert → render
│   └── extension.md             ← 拓展点架构（横向 Hook）
│
├── components/                  ← 组件组织
│   ├── directory.md             ← 物理组织 + 文件→目录膨胀
│   └── roles.md                 ← 编排 / 协议（概念解释）
│
├── protocol/                    ← 协议定义
│   ├── static.md                ← 01 ComponentNode / CSS / props / proportions
│   ├── behavior.md              ← 02 XState 状态机 / 运动参数
│   ├── runtime.md               ← 03 dryRun / invokeAction / RuntimeSnapshot
│   ├── resource.md              ← 04 资源引用契约（文本 / 图片）
│   └── layout.md                ← 05 私有布局映射（组件内部数据整理）
│
├── toolchain/                   ← 技术栈
│   ├── app-vue.md               ← App.vue 地基 + ResizeObserver
│   ├── converter.md             ← 换算层（% → px 纯函数）
│   ├── leafer.md                ← 渲染引擎（2D，可替换）
│   ├── xstate.md                ← 状态机引擎
│   ├── pretext.md               ← 文本测量布局库
│   └── zod.md                   ← 协议校验
│
├── guides/                      ← 指导
│   ├── constraints.md           ← 约束清单（#1–#20）
│   ├── ai-rules.md              ← AI 行为边界
│   ├── error-handling.md        ← 错误处理
│   ├── testing.md               ← 测试策略
│   └── migration.md             ← 引擎切换指南（待补充）
│
└── examples/                    ← 示例
    ├── quick-start.md           ← 三步上手
    └── app-vue.md               ← App.vue 完整骨架
```

## 快速入口

- **第一次看** → `examples/quick-start.md`
- **想看架构** → `arch/layers.md`
- **想加组件** → `components/directory.md` + `protocol/static.md`
- **想加交互** → `protocol/behavior.md`
- **引用资源** → `protocol/resource.md`
- **数据映射** → `protocol/layout.md`
- **想拓展能力** → `arch/extension.md`
- **想改渲染引擎** → `toolchain/leafer.md`
