/**
 * @intent
 * Toast 提示组件的渲染逻辑。
 * 在页面底部短暂展示操作反馈信息。
 */

import { Text } from 'leafer-ui'
import type { RenderContext } from '../types'

export function render(ctx: RenderContext): void {
  const { parent, tokens, data } = ctx
  const cw = parent.getBounds?.()?.width ?? 800
  const ch = parent.getBounds?.()?.height ?? 600

  const toast = new Text({
    x: cw * 0.5, y: ch - 30,
    text: data.toastMsg, fontSize: 14,
    fill: tokens.text, textAlign: 'center',
    backgroundColor: tokens.infoBg,
    padding: [8, 20], cornerRadius: 6,
    border: { stroke: tokens.border, strokeWidth: 1 },
  })
  toast.__isInteractive = true
  parent.add(toast)
}
