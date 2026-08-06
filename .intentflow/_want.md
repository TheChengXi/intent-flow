# 需求草案：加强编程工作流 — 加装前端链接

- 我想要加强编程工作流，加装前端的链接：人类用 pencil 画 UI 设计，AI 把设计复刻成实际项目的格式
  - ✓ 我想要写 pencil 画图工作流 skill（已落盘：_source/prompts/asking-ui/SKILL.md）
    - ✓ 询问：产品类型/目标界面/单独组件 + 颜色方向 + 字体/间距/阴影 + 三参数旋钮 + 可选约束
    - ✓ 配色：内置网站清单（Colormind/中国色 MCP/WPer/The Color API），官方搜索端点（?q= / MCP search），禁止全量拉取；多套输出画布摆色板，选定记录 token
    - ✓ 画法：原生 execute；组件平铺排列（不组合整页）；组件根/数据区/状态变体写 metadata（含过渡序列各状态）；完成标志 = 无布局问题
    - ✓ 修改：交修改（手改或文字反馈），每次只动一个维度，确认后交 design-to-protocol
    - ✓ 市面空白确认：现有 pencil skill 均为 MCP 操作手册，无画图工作流
  - ✓ 我想要写一套转换规则（已落盘：_source/prompts/design-to-protocol.md，18 条按提取/存放/验证三组）
    - ✓ 提取：Get 全量读节点（含 geometry 与 metadata）；画板=根基准锚点；读 metadata 为组件角色/状态变体/数据区直接依据；读 variables 保留 $ 引用
    - ✓ 存放：百分比换算（父组件为准 6 位小数）/ 动态尺寸三态 / geometry 原样 + viewBox bbox / token 提取（语义命名 + 4px 网格）/ 切分（角色标记：容器 vs 展示）/ 组合优于配置 / 占位符 + 状态分层 / 状态变体提取 / 根坐标丢弃 / colocate / 页面规则独立存放
    - ✓ 验证：转换后全量跑通（实际运行，对照 frontend-ui-engineering Verification 清单）
    - ✓ 核心原则确认：父组件为准 / 双态基准 / converter 补足定位 / 性能无忧（对齐时刻才换算）/ 迭代稳定性
    - 待定细节 1：往返精度（建议 6 位小数）
    - 待定细节 2：动态尺寸映射（fit_content → auto；fill_container → 100% 已定，未实测）
    - 待定细节 3：reflow vs 比例缩放（布局容器走 reflow，视觉元素走比例缩放）
    - 待定细节 4：geometry 采用原始相对命令还是绝对命令（建议固定一种）
    - ✓ 输入侧实证：pencil 仅 3 个 MCP 工具（无 export）；Get 结构化读取；polygon→path（SVG geometry）；官方导出对照（viewBox bbox / 绝对命令 / group 折叠 / name 保留）；局部导出（UI + Get 子树）；filePath 不生效（只操作活跃文件）；metadata/context 可读写
  - 我想要写组件观察台规格：设计阶段评判工具（画完好不好看），组件以百分比协议放入（→ 可执行）
    - ✓ 定位确认：观察台属于设计阶段（评判好不好看），转换后验证是实际运行（好不好用），非观察台
  - 我想要精简旧草案 component-protocol
    - ✓ 保留 engine 代码与协议核心（百分比计算方案 + token 计划）
    - ✓ 保留 arch/ components/ guides/ examples/ 全文
    - ✗ toolchain 压缩（已放弃：本身就是选型声明，无需压缩）
    - 待定：README 是否加转换规则入口（加一行链接指向 design-to-protocol）
  - 我想要把转换规则挂载进 execute 工作流：execute SKILL.md 中引用（→ 可执行）

## 已确认的分支决策（拆解过程记录）

- 转换目标格式：component-protocol 协议格式（百分比 + token）
- 转换规则 = 提取 + 存放；不写"协议 → DOM/框架代码"生成规则（留给项目技术栈）
- 转换规则与协议相互独立，execute 时分别引用
- 转换输入源：Get 结构化读取（export_nodes / export_html 在当前环境不存在）
- 人机分工：UI 视觉/审美决策归人类（平铺设计稿、色板选定、状态变体），AI 负责提取转换与执行
- 文本系统：内容文本写占位符，UI 固有文字写本体
- 状态变体：三态（loading/empty/error）+ 过渡序列各状态，均为设计层面输入，画了什么提什么
- 标注机制：设计稿写 metadata（component / data-slot / state），转换读标注不猜测
- 市面调研：前端 skill 生态（frontend-design 名气>实效；addyosmani 工程规范可吸收；taste-skill 三旋钮；ui-ux-pro-max 数据化设计系统；pencil-skills 无画图工作流）；配色 API（Colormind/中国色 MCP/WPer）；搜索姿势（官方端点优先，禁止全量拉取）
