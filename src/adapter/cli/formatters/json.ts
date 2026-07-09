// @intent: JSON 输出格式化器，输出标准 JSON 字符串

/**
 * @contract
 * 将任意数据格式化为 JSON 字符串。
 * 输入：data - 任何可序列化的数据
 * 输出：string - 格式化后的 JSON 字符串（缩进 2 空格）
 * 副作用：无
 */
export function formatJson(data: unknown): string {
  return JSON.stringify(data, null, 2);
}
