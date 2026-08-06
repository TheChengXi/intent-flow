# render.ts

`src/adapter/vscode/ui/webview/src/renderer/leafer/components/folder/render.ts`

**intent:** 文件夹组件的 Leafer 渲染逻辑。 接受 RenderContext（节点位置/状态/token），在 parent Group 中创建： ① 选中高亮（蓝色描边框） ② 📁 图标（emojis） ③ 文件夹名称（Text） ④ 展开/折叠角标（+ / −） ⑤ hover 缩放动效（1.08x） ⑥ tap → toggleFolder（展开/折叠） 输入：RenderContext（node.x/y 来自 layout 计算） 输出：向 parent 添加 Group 节点 不关心：node 的 x/y 从哪来、尺寸是 px 还是 %
