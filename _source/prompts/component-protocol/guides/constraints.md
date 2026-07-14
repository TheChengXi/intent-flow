# 约束清单

编号原则（#1–#20），AI 应严格遵守。

| # | 约束 | 违反后果 |
|---|------|---------|
| ① | **内容/结构分离**：协议（结构）与文案（内容）分开，文案不写死 | 内容耦合后无法复用 |
| ② | **dryRun 优先**：所有动作必须先 dryRun 再 invokeAction | 状态不可回退 |
| ③ | **组件自洽**：每个组件的主逻辑仅在一个目录内 | 出现跨目录的直接 import |
| ④ | **不 import 兄弟**：同层组件不互相 import，通过编排组件注入 | 依赖关系混乱 |
| ⑤ | **百分比优先**：所有尺寸用 %，不写死 px（除 border 宽度外） | 无法响应式缩放 |
| ⑥ | **颜色 token 化**：颜色仅通过 tokens 引用，不写死 hex/rgba | 无法全局换主题 |
| ⑦ | **identity 唯一**：每个协议组件 identity 全局唯一 | 运行时节点冲突 |
| ⑧ | **动作可序列化**：所有 Action 的 input/output 可 JSON 序列化 | 无法被 AI 验证 |
| ⑨ | **渲染引擎隔离**：renderer/ 是唯一引用渲染引擎的目录 | 引擎耦合，无法替换 |
| ⑩ | **换算层纯函数**：converter 不引用 Vue / Leafer / XState | 不可复用 / 不可测试 |
| ⑪ | **state.ts 可选**：组件不自持状态时不要 state.ts | 不必要的文件 |
| ⑫ | **单向数据流**：数据从外部（VS Code 消息）→ state.ts → render | 状态分散，难以追踪 |
| ⑬ | **状态机独立**：behavior.ts 不引用 Leafer | 渲染和交互耦合 |
| ⑭ | **Props 下传**：子组件数据通过 props 传入，不跨级读写 | 隐式依赖 |
| ⑮ | **无冗余兜底**：不存在逻辑路径的分支不写 else/fallback | 死代码 + 潜在 bug |
| ⑯ | **目录即组件**：一个组件一个目录，不拆散 | 结构混乱 |
| ⑰ | **identity = 运行时节点 id**：protocol 的 identity 必须对应 LeaferNode.id | 调试困难 |
| ⑱ | **侵入式交互标记者**：拦截交互时用 `__isInteractive` 标记 | 误拦截 |
| ⑲ | **文件膨胀为目录**：四维（protocol/render/behavior/state）以文件起步，膨胀时升格为目录，对外签名不变 | 维度膨胀后破坏调用方 |
| ⑳ | **路径别名引用**：跨层引用使用 TypeScript Path Aliases，减少相对路径计算成本 | 路径长且难以维护 |
| ㉑ | **proportions 优先于独立值**：若 `width` 和 `proportions` 同时存在，`height` 由比例推导，忽略 `height` 百分比；若同时提供 `width` 和 `height` + `proportions`，以 `width` 为基准推导 `height` 并告警 | 宽高比不一致 |
