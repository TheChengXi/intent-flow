/**
 * @intent
 * 访问策略接口。定义 shouldSkip(name) 抽象，与 policy.ts 的纯函数实现同域。
 * 归属 data/services/scope 的理由：该接口描述的是运行时的扩展作用域策略——属于基础设施策略而非应用编排。
 * 注：原“接口在 data、实现在 adapter”模式已于 pi-adapter-layer-reorg 推翻（adapter 层不再承载接口实现），本文件疑似闲置，待清理确认。
 * 边界：shouldSkip 返回 true 表示跳过拦截（放行），false 表示正常拦截。
 * 验收条件：
 * - 接口方法签名明确，不绑定任何实现细节
 * - 可作为类型在 ToolAccessGuard 和 ScopePolicy 之间双向引用
 */

export interface IAccessPolicy {
  /**
   * 指定扩展是否应跳过拦截。
   * @param extensionName — 扩展注册名，如 'confirm-edit'
   * @returns true=放行（不拦截），false=正常拦截
   */
  shouldSkip(extensionName: string): boolean;
}
