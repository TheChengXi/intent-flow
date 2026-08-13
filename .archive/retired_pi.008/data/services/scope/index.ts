/**
 * @intent
 * scope 策略模块对外出口，统一转发 shouldSkip 判定与 SCOPE_SKIP_ENV 环境变量名，收敛"哪些请求路径跳过工具访问策略"的引用入口。
 * 边界：仅转发不实现，实现位于 policy.ts。
 * 验收条件：
 * - shouldSkip 与 SCOPE_SKIP_ENV 均可从此入口导入
 */

export { shouldSkip, SCOPE_SKIP_ENV } from './policy';
