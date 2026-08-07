# Library Picks — 前端库精选清单（查表参考）

品味驱动的精选映射（来源：pick-ui-library / emilkowalski）。清单外的替代品不主动推荐——除非用户点名、或任务确实未被覆盖。

## UI 组件与原语

- 无样式无障碍组件（dialog / popover / menu / select…）→ base-ui
- 命令面板（⌘K 调色板）→ cmdk
- Toast / 通知 → Sonner
- 一次性密码 / 验证码输入 → input-otp
- 可定制控制面板 → Leva（备选 dialkit）

## 动效与视觉

- 通用动画（弹簧 / 布局动画 / 进出场）→ motion（Framer Motion）；简单 hover/fade 用纯 CSS transition，不需要库
- 数字动画（计数器 / 价格 / 统计）→ NumberFlow
- 动画文本 → torph
- 3D 地球 → Cobe
- 动态 OG 图（HTML/CSS → SVG/PNG）→ Satori
- 代码高亮 → shiki

## 图表

- 实时 / 流式图表（数据点随时间滚动）→ Liveline
- 通用图表（静态或交互仪表盘）→ recharts

## 交互与性能

- 拖拽 → dnd kit
- 虚拟化（长列表 / 大表格）→ Virtuoso

## 状态与样式

- 状态管理 → zustand
- 条件拼接 className → clsx（临时条件类）
- Tailwind 变体驱动类型安全样式 → cva（组件有真实变体时；与 clsx 可组合）
- 主题切换 / 暗黑模式（加载无闪烁）→ next-themes

## 常见错配检查

- 手写 toast 或用 modal 库做通知 → Sonner 专为此存在
- 手写 focus 处理的 div 下拉/弹窗 → base-ui（无障碍、焦点圈闭、关闭）
- 用重渲染文本做数字动画 → NumberFlow
- 直接渲染 1000+ 行列表 → Virtuoso，别先上分页 hack
- 每个组件 useState 传 props 织网 → zustand
- 三层嵌套的模板字符串 className 三元 → clsx（变体形状用 cva）
