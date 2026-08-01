/**
 * @intent
 * IGuardToggleService 的 application 层实现。构造时经 GuardToggleStore.read() 一次性同步加载初始状态，运行时持有内存状态；toggle() 先翻转内存再异步写回文件。
 * 边界：构造时读取失败由 store 兜底为 true（安全态），本类不做二次兜底；toggle() 写失败抛错，但内存已翻转（本次会话生效）。
 * 验收条件：
 * - 构造后 isEnabled() 反映 store 中持久化状态
 * - toggle() 翻转内存并成功写回，返回新状态
 * - 写失败时抛错，且 isEnabled() 已为新值
 */

import type { GuardToggleStore } from '../../data/services/guard/GuardToggleStore';
import type { IGuardToggleService } from './IGuardToggleService';

export class GuardToggleService implements IGuardToggleService {
  private enabled: boolean;

  constructor(private store: GuardToggleStore) {
    // @step 构造时一次性同步加载初始状态，store 内部兜底安全态 true
    this.enabled = this.store.read();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async toggle(): Promise<boolean> {
    // @step 先翻转内存，再异步写回；写失败抛错但内存已翻转（本次会话生效）
    this.enabled = !this.enabled;
    await this.store.write(this.enabled);
    return this.enabled;
  }
}
