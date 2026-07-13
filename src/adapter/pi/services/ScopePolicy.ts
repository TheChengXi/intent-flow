/**
 * @intent
 * IAccessPolicy 的 adapter 层桥接实现。委托 data/services/scope/policy.shouldSkip() 执行实际环境变量判断。 存在的意义：满足 DIP 约束——data 层的纯函数不应被 adapter 层直接跨层 import，由本桥接层中转。 边界：纯委托，不含任何逻辑；shouldSkip 返回 boolean，不抛异常。 验收条件： - 实现 IAccessPolicy 接口 - 委托调用 data/services/scope/policy.shouldSkip() 结果一致
 */

import { shouldSkip } from '../../../data/services/scope/policy';
import type { IAccessPolicy } from '../../../application/services/IAccessPolicy';

export class ScopePolicy implements IAccessPolicy {
  constructor() {}

  /**
   * @contract
   * 委托 data/services/scope/policy.shouldSkip() 判断扩展是否应跳过拦截。
   * 输入：extensionName - 扩展注册名
   * 输出：boolean - true=放行（不拦截），false=正常拦截
   * 副作用：无
   */
  /**
   * @step
   * 1. 直接调用 data 层纯函数 shouldSkip(extensionName)
   * 2. 原样返回其结果
   */
  shouldSkip(extensionName: string): boolean {
    return shouldSkip(extensionName);
  }
}
