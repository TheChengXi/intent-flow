/**
 * @intent
 * 换算层的类型定义。只描述协议树中与换算相关的字段，
 * 不关心 props、tokens 等换算无关的数据。
 */

/** 像素坐标边界 */
export interface PxBounds {
  x: number
  y: number
  width: number
  height: number
}

/**
 * @intent
 * 协议节点的换算子集。只取 identity（映射键）、
 * css（百分比值）、slots（递归）三个字段。
 * 文本节点额外携带 content/font/lineHeight，用于 Pretext 高度推算。
 */
export interface ConvertNode {
  identity: string
  css: {
    width?: string   // "60%" | "100%" | "auto"
    height?: string  // "30%" | "auto"
    left?: string    // "10%"
    top?: string     // "10%"
  }
  slots?: Array<{
    name: string
    children?: ConvertNode[]
  }>
  /** 文本内容（text 类型节点使用） */
  textContent?: string
  /** 字体 CSS 简写（text 类型节点使用，如 "14px Inter"） */
  textFont?: string
  /** 行高 px（text 类型节点使用） */
  textLineHeight?: number
}

/**
 * @intent
 * 预编译后的换算节点。所有百分比已提前解析为比值，
 * 换算阶段只做乘法，不做 parseFloat。
 */
export interface CompiledNode {
  identity: string
  ratioWidth: number | 'auto'
  ratioHeight: number | 'auto'
  ratioX: number
  ratioY: number
  children: CompiledNode[]
  textContent?: string
  textFont?: string
  textLineHeight?: number
}

/** 文本高度计算器的接口，由外部注入 */
export interface TextHeightResolver {
  (text: string, font: string, lineHeight: number, containerWidth: number): number
}
