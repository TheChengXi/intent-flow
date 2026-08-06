---
name: asking-ui
description: 在 pencil 画布内画 UI 草稿：询问设计偏好，按方向搜配色，画布摆色板选定，生成草稿，修改确认。
---

# AskingUI

以下规则具有最高优先级。

画 UI 草稿。只产出设计稿。

## pencil 约束

- 文本节点一律显式 lineHeight（字号 ≥34 → 1.15，≥17 → 1.3，≥14 → 1.35，其余 → 1.4，多行段落 → 1.6-1.8）
- 跨 execute 引用一律用节点 ID
- stroke 只接受纯色值；按边描边拆独立 hairline frame（height:1 + fill）
- fit_content 父容器内子项禁用 fill_container（塌缩为 0）
- 根层定位用 FindEmptySpace：direction "right"，padding ≥ 80，nodeId 链式锚定

## 询问

缺口大 → 多维并行问；接近清晰 → 收尾。

1. 产品类型 / 目标界面 / 组件数量（多少个组件、是否含页面跳转，是否含特殊动效，关键帧需要画几个）
2. 颜色方向（科技 / 文化 / 清新 / 酷 / 复古…）
3. 字体层级 / 整体间距 / 阴影系统
4. 三参数旋钮 1-10：设计方差 / 动效 / 密度
5. 可选约束：品牌色 / 移动优先 / 无障碍等级 / 技术栈

设计稿状态表达：多种状态 = 多画 UI——页面跳转画多个页面，按钮过渡画各状态样式，每个状态单独平铺。

信息缺失不猜测 → 返回问题清单。

## 配色

按方向从内置清单选源 → 调用官方搜索端点（?q= 参数或 MCP search，禁止全量拉取本地过滤）→ 多套配色输出到画布（色块 + 色值标注）→ 选定后记录为 token。

内置清单：
- Colormind（POST http://colormind.io/api/，input 数组锁定主色、"N" 为不锁定）
- espectro.dev（GET https://espectro.dev/api/colors?search=关键词）

## 生成草稿

1. 确认目标 .pen 为编辑器活跃文件，操作前 Get 了解现状
2. 选定色板 → SetVariables 设 token（语义命名）
3. 平铺布局：产出物全部平铺于 document 根层——每个区块一个独立顶层 frame，FindEmptySpace 逐个排开（direction: right，padding ≥ 80），区块间互不嵌套、互不重叠
   粒度：一个区块 = 可复用组件（按钮/卡片/标签…）、页面区段（导航栏 / Hero / 数据条 / 功能区 / 页脚…）、状态变体（每种状态单独一块）
   禁止 page 级父 frame 包裹多个区块；区块归属页面与角色写 metadata（type: component / section / state，role，page）
   Insert reusable 组件 → ref 复用（单一职责、组合优于配置）
4. 搭组件内部结构（frame：layout / gap / padding / fill_container / clip）——区块内部可嵌套，区块之间不嵌套
5. 放置内容：文本设 fill；图标用 icon 类型；图片 Generate 填充容器；形状用 SVG path；数据区写 metadata（type: data-slot / kind）；状态变体节点写 metadata（state: loading / empty / error / 过渡序列各状态），过渡序列每个状态单独平铺画出
6. Get 检查布局（clipped / 对齐 / 文本溢出 / 区块重叠）

完成标志：所有区块独立平铺、互不重叠、无整页组合容器，无布局问题，草稿可交修改。

## 修改

草稿完成 → 交修改（画布手改或文字反馈）→ 每次只动一个维度 → 确认后输出最终设计稿。
