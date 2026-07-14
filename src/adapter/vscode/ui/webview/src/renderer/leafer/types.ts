/**
 * @intent
 * 渲染引擎通用类型定义。
 * RenderContext 是 Leafer 渲染引擎中所有组件 render() 函数的统一入参格式。
 */

export interface RenderContext {
  parent: any
  node: any
  tokens: Record<string, string>
  data: any
  invokeAction: (name: string, payload?: any) => void
}
