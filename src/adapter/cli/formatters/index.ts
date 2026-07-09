// @intent: CLI 输出格式化器统一导出，提供 getFormatter 工厂函数

import { formatJson } from './json';
import { formatPretty } from './pretty';
export { formatJson, formatPretty };

export type FormatterType = 'pretty' | 'json';

/**
 * @contract
 * 根据类型返回对应的格式化函数。
 * 输入：type - 'pretty' | 'json'
 * 输出：(data: unknown) => string - 格式化函数
 * 副作用：无
 */
export function getFormatter(type: FormatterType): (data: unknown) => string {
  switch (type) {
    case 'json':
      return formatJson;
    case 'pretty':
    default:
      return formatPretty;
  }
}
