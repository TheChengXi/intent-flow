/**
 * @intent
 * ImportResolver 实现间共享的工具函数。
 * cleanStringLiteral：清洗 AST 或 regex 提取的字符串字面量（去掉引号/尖括号）。
 * 注意保持纯函数，无副作用。
 */

/** 去除字符串两端的引号、反引号、尖括号 */
export function cleanStringLiteral(str: string): string {
  return str.replace(/^['"`<]|['"`>]$/g, '');
}
