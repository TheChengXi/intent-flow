// @intent: 人类可读输出格式化器，输出带颜色和缩进的控制台文本

/**
 * @contract
 * 将任意数据格式化为人类可读的文本。
 * 输入：data - 要格式化的数据（支持对象、数组、基本类型）
 * 输出：string - 格式化后的文本，带缩进和分隔符
 * 副作用：无
 * @boundary
 * - 数组每个元素用分隔行（---）隔开
 * - 对象按 key: value 展开，嵌套对象递归缩进
 * - 简单类型直接 toString
 */
export function formatPretty(data: unknown, indent: number = 0): string {
  const pad = '  '.repeat(indent);

  if (data === null || data === undefined) {
    return `${pad}<null>`;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) return `${pad}(empty)`;
    return data.map(item => `${formatPretty(item, indent)}`).join(`\n${pad}---\n`);
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return `${pad}{ }`;
    return entries
      .map(([key, value]) => {
        if (value !== null && typeof value === 'object') {
          return `${pad}${key}:\n${formatPretty(value, indent + 1)}`;
        }
        return `${pad}${key}: ${formatValue(value)}`;
      })
      .join('\n');
  }

  return `${pad}${formatValue(data)}`;
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'boolean' || typeof value === 'number') return String(value);
  return JSON.stringify(value);
}
