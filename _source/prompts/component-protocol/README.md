# 组件协议族

一套 UI 组件协议。定义组件长什么样、怎么动、数据怎么流。
核心思想：**组件用百分比定义尺寸，用纯函数换算坐标，用语义路径引用资源。**

## 索引

```
protocol/
├── arch/                        ← 架构
│   ├── layers.md                ← 分层架构（协议层 + 换算层）
│   ├── data-flow.md             ← 数据流向（dryRun → convert → render）
│   └── extension.md             ← 拓展点架构（横向 Hook）
│
├── components/                  ← 组件组织
│   ├── directory.md             ← 物理组织 + 文件→目录膨胀
│   └── roles.md                 ← 组件能力与通信
│
├── protocol/                    ← 协议定义
│   ├── static.md                ← 01 ComponentNode / CSS / props / proportions
│   ├── behavior.md              ← 02 状态机契约 / 运动参数
│   ├── runtime.md               ← 03 dryRun / invokeAction / RuntimeSnapshot
│   ├── resource.md              ← 04 资源引用契约（文本 / 图片）
│   └── layout.md                ← 05 私有布局映射（组件内部数据整理）
│
├── toolchain/                   ← 技术栈参考
│   ├── converter.md             ← 换算层实现（% → px 纯函数）
│   ├── leafer.md                ← 渲染引擎：Leafer（2D Canvas）
│   ├── xstate.md                ← 状态机引擎：XState
│   ├── pretext.md               ← 文本测量：@chenglou/pretext
│   └── zod.md                   ← 协议校验：Zod
│
├── guides/                      ← 指导
│   ├── constraints.md           ← 约束清单
│   ├── ai-rules.md              ← AI 行为边界
│   ├── error-handling.md        ← 错误处理
│   ├── testing.md               ← 测试策略
│   └── migration.md             ← 引擎切换指南（待补充）
│
└── examples/                    ← 示例
    └── quick-start.md           ← 三步上手
```

## 快速入口

- **第一次看** → `examples/quick-start.md`
- **想看架构** → `arch/layers.md`
- **想加组件** → `components/directory.md` + `protocol/static.md`
- **想加交互** → `protocol/behavior.md`
- **引用资源** → `protocol/resource.md`
- **数据映射** → `protocol/layout.md`
- **想拓展能力** → `arch/extension.md`
