# ToPencil — pencil 画布使用教程

以下规则具有最高优先级。

画局部 UI 组件规格（变体 + 状态 + 动效关键帧）。不生成整页组合——页面由组件拼装，拼装属代码层。验证一律文本断言，不依赖视觉判断。

## 工具边界

- 无对象动画系统：实时动画仅 shader fill @time（效果层）；UI 动效一律关键帧平铺表达（见插槽标准）
- 图片非节点：图片是 fill（Generate / image fill）；设计稿一律占位插槽
- script 节点生成静态结构（非动画），需外部 .js 文件，草稿阶段不用

## 设计系统

- 库组件优先：画布已导入 shadcn 库（reusable 组件：Button/*、Icon Button/*、Card、Sidebar、Table、Data Table、Modal/*、Input Group/*、Badge/*、Tabs、Dropdown、Pagination 等）——先复用库组件（Insert ref 实例化 + descendants 定制），库中没有的才自建
- 变量：一律用库的 $-- 语义 token（$--background / $--foreground / $--muted-foreground / $--card / $--border / $--primary / $--primary-foreground / $--secondary / $--destructive / $--sidebar / $--sidebar-border / $--font-primary / $--radius-*），禁止硬编码 hex 色值
- 变体命名：自建可复用组件用 类别/变体 斜杠层级（Button/Default、Tab Item/Active、List Item/Checked）
- slot 插槽：容器组件预留插槽 frame（slot 属性标记），实例化后子组件插到 instanceId/slotId 路径；某插槽不用 → enabled:false
- 图标封装：icon 包在 frame 内（控制命中区尺寸），默认 enabled:false 预留，用时打开
- 主题：库组件带多轴 theme（Mode/Base/Accent），新页面沿用同轴主题

## 插槽标准

- 文字类插槽：不生成真实文案，统一占位符填充——「标题占位」「正文占位」「按钮占位」等，占位符长度近似真实内容
- 图片类插槽：不生成、不寻找真实图片，只提供尺寸合适的占位插槽——frame 设目标尺寸 + 占位 fill + metadata（type: image-slot / 尺寸 / 用途），尺寸与真实使用场景匹配
- 动效组件：拆为关键帧序列，每个关键帧 = 一张独立 UI——每帧一个独立顶层 frame 平铺，metadata 标注（type: keyframe / seq: N / duration / easing）；禁止时间轴、禁止单 frame 内叠加连续帧、禁止运动轨迹

## pencil 约束

- 文本节点一律显式 lineHeight（字号 ≥34 → 1.15，≥17 → 1.3，≥14 → 1.35，其余 → 1.4，多行段落 → 1.6-1.8）
- 跨 execute 引用一律用节点 ID
- stroke 只接受纯色值；按边描边拆独立 hairline frame（height:1 + fill）
- fit_content 父容器内子项禁用 fill_container（塌缩为 0）
- 根层定位用 FindEmptySpace：direction "right"，padding ≥ 80，nodeId 链式锚定
- 所有节点 name 语义化（区块/部件意图，如 CardContainer / ArmR_Upper），不用默认名

## 生成草稿

1. 确认目标 .pen 为编辑器活跃文件，Get 了解现状：GetVariables 读既有 token、Get 搜 reusable 组件——库组件优先复用（见设计系统）、token 语义沿用，不重复造
2. 选定色板 → SetVariables 设 token（语义命名）
3. 平铺布局：产出物全部平铺于 document 根层——每个区块一个独立顶层 frame，FindEmptySpace 逐个排开（direction: right，padding ≥ 80），区块间互不嵌套、互不重叠
   粒度：一个区块 = 组件变体（Button/Default、Button/Outline…）、状态（loading / empty / error / disabled，每种状态单独一块）、动效关键帧（每帧一块）
   禁止 page 级父 frame 包裹多个区块；区块归属页面与角色写 metadata（type: component / section / state，role，page）
   Insert reusable 组件 → ref 复用
4. 搭组件内部结构（frame：layout / gap / padding / fill_container / clip）——区块内部可嵌套，区块之间不嵌套
5. 放置内容：文本设 fill，文案按文字类插槽标准填占位符；图标按设计系统封装（frame 包 icon，enabled 开关）；图片按图片类插槽标准放占位插槽；形状用 SVG path；数据区写 metadata（type: data-slot / kind）；状态变体节点写 metadata（type: state，state: loading / empty / error / 过渡序列各状态），过渡序列每个状态单独平铺画出；动效按关键帧标准逐帧平铺（type: keyframe / seq）
6. 分区迭代：每个区块一个独立 execute 分区完成，每完成一个区块立即 Get 验证——输出各区块 bounds（断言：互不重叠、间距 ≥ 80）、ctx.problems（断言：无 clipped）、metadata 序列（断言：与设计一致）；通过再画下一个

完成标志：所有区块独立平铺、互不重叠；文本断言全通过（bounds 无重叠、无 clipped、metadata 序列正确）；组件规格可交调校。

## 修改

规格完成 → 交调校（画布手改或文字反馈）→ 每次只动一个维度 → 确认后输出最终组件规格。

## gotchas

- 全局变量不跨 execute：跨调用引用先用 Get 收集 name→id
- metadata 仅 Insert 时生效：Copy 派生帧继承源帧 metadata 且不可覆盖，Update 修改 metadata 不生效——关键帧逐帧 Insert 创建，禁止 Copy 派生后改 seq
- FindEmptySpace 链式锚定：nodeId 传前一区块 ID，禁止随机坐标
