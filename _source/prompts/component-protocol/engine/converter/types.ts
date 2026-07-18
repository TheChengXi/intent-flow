/**
 * @file 换算层类型定义
 * @intent
 * 只描述协议树中与换算相关的字段，
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
 * 协议节点的换算子集。
 * 只取 identity（映射键）、css（百分比值）、slots（递归）三个字段。
 * 文本节点额外携带 content/font/lineHeight，用于文本高度推算。
 */
export interface ConvertNode {
  /** 节点唯一标识，用作结果映射的 key */
  identity: string
  css: {
    /** 宽度百分比，如 "60%" | "100%" | "auto" */
    width?: string
    /** 高度百分比，如 "30%" | "auto" */
    height?: string
    /** x 偏移百分比，参照容器宽度 */
    left?: string
    /** y 偏移百分比，参照容器高度 */
    top?: string
  }
  /** 子节点插槽 */
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
 * 预编译后的换算节点。
 * 所有百分比已提前解析为比值（0~1），换算阶段只做乘法。
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

/**
 * 文本高度计算器的接口。
 * 由外部注入，不依赖具体实现。
 *
 * @param text - 文本内容
 * @param font - CSS font 简写
 * @param lineHeight - 行高 px
 * @param containerWidth - 容器宽度 px
 * @returns 文本高度 px
 */
export interface TextHeightResolver {
  (text: string, font: string, lineHeight: number, containerWidth: number): number
}
