/**
 * @intent
 * 访问策略接口。定义 shouldSkip(name) 抽象，供 adapter 层实现和消费。 纯接口文件，零运行时依赖。 边界：shouldSkip 返回 true 表示跳过拦截（放行），false 表示正常拦截。 验收条件： - 接口方法签名明确，不绑定任何实现细节 - 可作为类型在 ToolAccessGuard 和 ScopePolicy 之间双向引用
 */

export interface IAccessPolicy {
  /**
   * 指定扩展是否应跳过拦截。
   * @param extensionName — 扩展注册名，如 'confirm-edit'
   * @returns true=放行（不拦截），false=正常拦截
   */
  shouldSkip(extensionName: string): boolean;
}
