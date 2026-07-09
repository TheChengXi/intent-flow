/**
 * @intent
 * 信息面板组件的渲染逻辑。
 * 展示文件详情：文件名、@intent 标注，支持关闭。
 */

import { Rect, Text } from 'leafer-ui'
import type { RenderContext } from '../types'
import { text } from '../../../resource/text/info-panel'

export function render(ctx: RenderContext): void {
  const { parent, tokens, data, invokeAction } = ctx
  const cw = parent.getBounds?.()?.width ?? 800
  const ch = parent.getBounds?.()?.height ?? 600
  const panelW = cw * 0.35
  const panelX = cw - panelW

  // 遮罩
  parent.add(new Rect({
    x: 0, y: 0, width: cw, height: ch, fill: 'rgba(0,0,0,0.1)',
  }))

  // 面板背景
  parent.add(new Rect({
    x: panelX, y: 0, width: panelW, height: ch,
    fill: tokens.sideBg, stroke: tokens.border, strokeWidth: 1,
  }))

  // 标题
  parent.add(new Text({
    x: panelX + 12, y: 12,
    text: text.title, fontSize: 15, fill: tokens.text, fontWeight: 'bold',
  }))

  // 关闭按钮
  const closeBtn = new Text({
    x: panelX + panelW - 30, y: 10,
    text: text.closeBtn, fontSize: 16, fill: tokens.text, textAlign: 'center',
  })
  closeBtn.__isInteractive = true
  closeBtn.cursor = 'pointer'
  closeBtn.on('tap', () => invokeAction('hideInfo'))
  parent.add(closeBtn)

  // 文件名
  parent.add(new Text({
    x: panelX + 12, y: 44,
    text: data.infoFile, fontSize: 13, fill: tokens.link,
    width: panelW - 24,
  }))

  // @intent 标签
  parent.add(new Text({
    x: panelX + 12, y: 90,
    text: text.intentLabel, fontSize: 12, fill: tokens.textMuted,
  }))

  // intent 内容
  parent.add(new Text({
    x: panelX + 12, y: 110,
    text: data.infoIntent || '(无 @intent)',
    fontSize: 14, fill: tokens.text, width: panelW - 24,
  }))
}
