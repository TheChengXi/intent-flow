/**
 * @intent 扩展作用域策略。通过 PI_EXT_SKIP 环境变量控制
 * 哪些 pi 扩展在子 agent 上下文中跳过拦截。
 * 纯函数，零依赖，可被任意外部扩展导入。
 * 边界：环境变量不存在或为空时，shouldSkip 永远返回 false（不跳过）。
 */

export const SCOPE_SKIP_ENV = 'PI_EXT_SKIP';

/**
 * 当前进程上下文中，指定扩展是否应跳过拦截。
 * @param extensionName — 扩展注册名，如 'confirm-edit'、'permission-gate'
 * @returns true=放行（不拦截），false=正常拦截
 */
export function shouldSkip(extensionName: string): boolean {
  const raw = process.env[SCOPE_SKIP_ENV];
  if (!raw) return false;
  return raw.split(',').map(s => s.trim()).includes(extensionName);
}
