/**
 * @intent
 * 守卫开关服务接口。定义 isEnabled()/toggle() 抽象，与 data/services/guard/GuardToggleStore 同域（同 IAccessPolicyService 模式）。
 * 语义：isEnabled() 返回 true 表示守卫开启（弹确认框拦截），false 表示守卫关闭（放行）；toggle() 翻转状态并持久化，返回翻转后的新状态。
 * 边界：isEnabled() 为同步调用且不抛异常；toggle() 为异步，持久化失败时抛错（此时内存状态已翻转，本次会话生效）。
 * 验收条件：
 * - 接口签名明确，不绑定任何实现细节
 * - isEnabled() 同步返回 boolean；toggle() 返回 Promise<boolean>（新状态）
 */

export interface IGuardToggleService {
  /** 守卫是否开启：true=拦截确认，false=放行 */
  isEnabled(): boolean;

  /** 翻转开关状态并持久化，返回翻转后的新状态；持久化失败抛错 */
  toggle(): Promise<boolean>;
}
