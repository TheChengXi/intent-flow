# render.ts

`src/adapter/vscode/ui/webview/src/renderer/leafer/components/connection-line/render.ts`

**intent:** 连接线组件的渲染逻辑。 根据每种节点类型的真实视觉尺寸计算连线端点， 确保连接线对齐到原子节点的视觉中心/顶部/底部。 视觉锚点表（纯像素值，与 render/*.ts 中的绘制位置对齐）： folder          📁 (0,0) fontSize:24 + 文字 (0,28) fontSize:12 文字中点: node.x, 视觉底部: node.y + 40 file            📄 (6,3) fontSize:13  → 宽≈13px, 高≈16px 视觉顶部: node.y + 3 intent-package  圆 r=50, Group(node.x-r, node.y-r) 视觉中心: (node.x, node.y) 视觉顶部: node.y - 50 视觉底部: node.y + 50
