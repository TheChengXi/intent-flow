/**
 * @intent
 * 空状态组件的渲染逻辑。
 * 无数据时展示引导界面：图标 + 说明 + 选择按钮 + 图例。
 */

import { Group, Rect, Text } from 'leafer-ui'
import type { RenderContext } from '../types'
import { text } from '../../../resource/text/empty-state'

export function render(ctx: RenderContext): void {
  const { parent, tokens, data, invokeAction } = ctx
  const cw = parent.getBounds?.()?.width ?? 800
  const ch = parent.getBounds?.()?.height ?? 600
  const cx = cw * 0.5

  // ── 相对顺序布局 ──
  // 每个元素只定义自身高度和到下一个元素的间距，不写死 y 坐标
  // 增删元素或调间距时，后面自动跟着位移
  const gap: number[] = [28, 14, 22, 34]  // 元素之间的间距
  const btnW = 160, btnH = 36

  // 估算总高度，算出起点使整体垂直居中
  const heights = [48, 24, 17, btnH, 11]
  const totalH = heights.reduce((s, h, i) => s + h + (gap[i] ?? 0), 0)
  let cursorY = (ch * 0.45) - totalH / 2

  // 图标 (fontSize 48 ≈ 48px 高)
  parent.add(new Text({
    x: cx, y: cursorY,
    text: text.icon, fontSize: 48, textAlign: 'center',
  }))
  cursorY += 48 + gap[0]

  // 标题 (fontSize 20 ≈ 24px 高)
  parent.add(new Text({
    x: cx, y: cursorY,
    text: text.title, fontSize: 20, fill: tokens.text,
    fontWeight: 'bold', textAlign: 'center',
  }))
  cursorY += 24 + gap[1]

  // 描述 (fontSize 14 ≈ 17px 高)
  parent.add(new Text({
    x: cx, y: cursorY,
    text: text.description,
    fontSize: 14, fill: tokens.textMuted, textAlign: 'center',
  }))
  cursorY += 17 + gap[2]

  // 选择按钮 — Group 包裹，避免文字盖住 Rect 导致事件丢失
  const btnG = new Group({ x: cx - btnW / 2, y: cursorY })
  const btn = new Rect({
    x: 0, y: 0,
    width: btnW, height: btnH, cornerRadius: 6, fill: tokens.primary,
  })
  btnG.add(btn)
  btnG.add(new Text({
    x: btnW / 2, y: btnH / 2,
    text: text.selectBtn, fontSize: 15,
    fill: tokens.primaryText, textAlign: 'center', verticalAlign: 'middle',
  }))
  btnG.__isInteractive = true
  // empty-state 下 drag 已禁用，down 即触发，不等 tap
  btnG.on('pointer.down', () => {
    btn.fill = tokens.primary
    btn.scaleX = 0.96
    btn.scaleY = 0.96
    invokeAction('selectFolder')
  })
  btnG.on('pointer.enter', () => { btn.fill = tokens.primaryHover })
  btnG.on('pointer.leave', () => { btn.fill = tokens.primary; btn.scaleX = 1; btn.scaleY = 1 })
  parent.add(btnG)
  cursorY += btnH + gap[3]

  // 图例 — 按实际文本宽度计算位置，整体居中
  const itemGap = 32  // 图例项间距
  // 13px 字号下每个中文字 ≈ 14px
  const charW = 14
  const cornerMap = [2, 6, 3]  // 文件夹 / 组合能力 / 元能力 的形状区分
  const items = text.legend.map((item, i) => ({
    ...item,
    cornerRadius: cornerMap[i] ?? 0,
    totalW: 11 + 5 + item.label.length * charW,
  }))
  const totalW = items.reduce((s, it) => s + it.totalW, 0) + (items.length - 1) * itemGap
  let cursorX = cx - totalW / 2
  items.forEach((item) => {
    parent.add(new Rect({
      x: cursorX, y: cursorY,
      width: 11, height: 11,
      cornerRadius: item.cornerRadius,
      fill: item.color,
    }))
    parent.add(new Text({
      x: cursorX + 16, y: cursorY - 2,
      text: item.label, fontSize: 13, fill: tokens.textMuted,
    }))
    cursorX += item.totalW + itemGap
  })
  cursorY += 11 + 40  // 图例高度 + 底部留白
}
