/**
 * @intent
 * IAccessPolicyService 的 application 层实现（自 adapter/pi/services/ 下沉）。纯委托 data/services/scope/policy.shouldSkip() 执行实际环境变量判断，不含任何 pi 平台依赖，故归 application 层。
 * 边界：纯委托，不含任何逻辑；shouldSkip 返回 boolean，不抛异常。
 * 验收条件：
 * - 实现 IAccessPolicyService 接口
 * - 委托调用 data/services/scope/policy.shouldSkip() 结果一致
 */


import { shouldSkip } from '../../data/services/scope/policy';
import type { IAccessPolicyService } from './IAccessPolicyService';

export class ScopePolicy implements IAccessPolicyService {
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
