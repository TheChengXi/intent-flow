/**
 * @intent 访问策略服务接口。定义 shouldSkip(name) 抽象，与 data/services/scope/policy.ts 的纯函数同域。
 * 归属 application 层，供 adapter 层的 ToolAccessGuard 依赖，避免 adapter 直接跨层引用 data 层。
 * shouldSkip 返回 true 表示跳过拦截（放行），false 表示正常拦截。
 */

export interface IAccessPolicyService {
  /**
   * 指定扩展是否应跳过拦截。
   * @param extensionName — 扩展注册名，如 'confirm-edit'
   * @returns true=放行（不拦截），false=正常拦截
   */
  shouldSkip(extensionName: string): boolean;
}
