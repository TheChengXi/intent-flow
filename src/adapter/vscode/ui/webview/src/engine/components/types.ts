/**
 * @intent
 * 组件渲染上下文。一个组件 render() 需要的信息都装在这里。
 */

export interface RenderContext {
  parent: any
  node: any
  tokens: Record<string, string>
  data: any
  invokeAction: (name: string, payload?: any) => void
}
