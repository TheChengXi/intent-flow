---
name: asking-ui
description: 在 pencil 画布内画 UI 草稿：询问设计偏好，按方向搜配色，画布摆色板选定，生成草稿，修改确认。
---

# AskingUI

以下规则具有最高优先级。

画 UI 草稿。只产出设计稿

## 询问

缺口大 → 多维并行问；接近清晰 → 收尾。

1. 产品类型 / 目标界面 / 组件数量（多少个组件、是否含页面跳转）
2. 颜色方向（科技 / 文化 / 清新 / 酷 / 复古…）
3. 字体层级 / 整体间距 / 阴影系统
4. 三参数旋钮 1-10：设计方差 / 动效 / 密度
5. 可选约束：品牌色 / 移动优先 / 无障碍等级 / 技术栈

设计稿状态表达：多种状态 = 多画 UI——页面跳转画多个页面，按钮过渡画各状态样式，每个状态单独平铺。

信息缺失不猜测 → 返回问题清单。

## 配色

按方向从内置清单选源 → 调用官方搜索端点（?q= 参数或 MCP search，禁止全量拉取本地过滤）→ 多套配色输出到画布（色块 + 色值标注）→ 选定后记录为 token。

内置清单：
- 科技 / 现代：Colormind（GAN，可锁定主色）、Coolors
- 文化 / 传统：中国色 zhongguose.com（MCP search_colors）
- 色系 / 极简：WPer（?type=light/dark/red）
- 通用：The Color API（/scheme）、Color Palette Generator

## 生成草稿

1. 确认目标 .pen 为编辑器活跃文件，操作前 Get 了解现状
2. 选定色板 → SetVariables 设 token（语义命名）
3. 组件平铺排列：每个组件独立画出、排开（地图一块 / 背景一块 / 导航栏一块…），不组合成整页；Insert reusable 组件 → ref 复用（单一职责、组合优于配置）；组件根写 metadata（type: page / component / role / state）
4. 搭组件内部结构（frame：layout / gap / padding / fill_container / clip）
5. 放置内容：文本设 fill；图标用 icon 类型；图片 Generate 填充容器；形状用 SVG path；数据区写 metadata（type: data-slot / kind）；状态变体节点写 metadata（state: loading / empty / error / 过渡序列各状态），过渡序列每个状态单独平铺画出
6. Get 检查布局（clipped / 对齐 / 文本溢出）

完成标志：无布局问题，草稿可交修改。

## 修改

草稿完成 → 交修改（画布手改或文字反馈）→ 每次只动一个维度 → 确认后输出最终设计稿，交 design-to-protocol。
