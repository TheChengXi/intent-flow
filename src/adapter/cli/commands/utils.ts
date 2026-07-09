// @intent: CLI 参数解析工具函数，分离位置参数和标志参数

/**
 * @contract
 * 解析 CLI 参数数组，分离位置参数和标志参数。
 * 输入：argv - 原始参数数组（不含命令名）
 * 输出：{ positional: string[] - 位置参数; flags: Record<string, string> - 标志参数 }
 * 副作用：无
 * @boundary
 * - 以 -- 开头的参数识别为标志参数
 * - 下一个不以 -- 开头的参数视为标志值
 * - 其余识别为位置参数
 * - --json 等无值标志的值为 'true'
 */
export function parseArgs(argv: string[]): { positional: string[]; flags: Record<string, string> } {
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg.startsWith('--')) {
      // @step: 提取 --flag 或 --flag=value
      const eqIndex = arg.indexOf('=');
      if (eqIndex > 2) {
        flags[arg.slice(2, eqIndex)] = arg.slice(eqIndex + 1);
      } else {
        const key = arg.slice(2);
        // @step: 如果下一个参数不是标志，则作为值
        if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
          flags[key] = argv[++i];
        } else {
          flags[key] = 'true';
        }
      }
    } else if (arg.startsWith('-') && arg.length > 1 && !arg.startsWith('--')) {
      // @step: 处理 -f 短标志
      const key = arg.slice(1);
      if (i + 1 < argv.length && !argv[i + 1].startsWith('-')) {
        flags[key] = argv[++i];
      } else {
        flags[key] = 'true';
      }
    } else {
      // @step: 收集位置参数
      positional.push(arg);
    }
  }

  return { positional, flags };
}

/**
 * @contract
 * 检查参数数组中是否存在指定标志（无论是否有值）。
 * 输入：argv - 原始参数数组; name - 标志名（不含 --）
 * 输出：boolean - 是否存在
 * 副作用：无
 */
export function hasFlag(argv: string[], name: string): boolean {
  const longFlag = `--${name}`;
  const shortFlag = name.length === 1 ? `-${name}` : null;
  return argv.some(a => a === longFlag || a === shortFlag || a.startsWith(`${longFlag}=`));
}
