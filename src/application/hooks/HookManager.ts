import { IHook } from './IHook';
import { HookName, HookDataMap } from './HookTypes';

/**
 * @intent
 * Hook 系统的编排核心，管理 9 个 Hook 点的注册/取消/并行触发。
 * 边界：单个 Hook 失败不中断主流程；on_error Hook 防无限递归
 */

export class HookManager {
  private hooks: Map<HookName, IHook[]> = new Map();

  // @contract: register(hookName: HookName, hook: IHook) => void
  // @step: [获取 Hook 列表] 获取该 Hook 点的 Hook 列表
  // @step: [添加 Hook] 将 Hook 添加到列表
  register(hookName: HookName, hook: IHook): void {
    if (!this.hooks.has(hookName)) {
      this.hooks.set(hookName, []);
    }

    this.hooks.get(hookName)!.push(hook);
    console.log(`[HookManager] 注册 Hook: ${hookName} - ${hook.name}`);
  }

  // @contract: unregister(hookName: HookName, hook: IHook) => void
  // @step: [获取 Hook 列表] 获取该 Hook 点的 Hook 列表
  // @step: [移除 Hook] 从列表中移除 Hook
  unregister(hookName: HookName, hook: IHook): void {
    const hooks = this.hooks.get(hookName);
    if (hooks) {
      const index = hooks.indexOf(hook);
      if (index > -1) {
        hooks.splice(index, 1);
        console.log(`[HookManager] 取消注册 Hook: ${hookName} - ${hook.name}`);
      }
    }
  }

  // @contract: trigger<T extends HookName>(hookName: T, data: HookDataMap[T]) => Promise<void>
  // @step: [获取 Hook 列表] 获取该 Hook 点的所有 Hook
  // @step: [并行执行] 并行执行所有 Hook
  // @step: [错误处理] Hook 错误不中断主流程
  async trigger<T extends HookName>(hookName: T, data: HookDataMap[T]): Promise<void> {
    const hooks = this.hooks.get(hookName) || [];

    if (hooks.length === 0) {
      return;
    }

    // 并行执行所有 Hook，使用 Promise.allSettled 确保错误不中断
    const results = await Promise.allSettled(
      hooks.map(async (hook) => {
        try {
          await this.executeHook(hook, hookName, data);
        } catch (error) {
          console.error(`[HookManager] Hook 执行失败: ${hook.name}`, error);
          // 触发 on_error Hook（避免无限递归）
          if (hookName !== 'on_error') {
            await this.trigger('on_error', {
              error: error as Error,
              operation: `hook:${hookName}:${hook.name}`,
              input: data
            });
          }
        }
      })
    );

    // 记录失败的 Hook
    const failed = results.filter(r => r.status === 'rejected');
    if (failed.length > 0) {
      console.warn(`[HookManager] ${failed.length} 个 Hook 执行失败`);
    }
  }

  // @contract: executeHook(hook: IHook, hookName: HookName, data: any) => Promise<void>
  // @step: [根据 Hook 名称] 调用对应的 Hook 方法
  private async executeHook(hook: IHook, hookName: HookName, data: any): Promise<void> {
    switch (hookName) {
      case 'before_extract':
        if (hook.onBeforeExtract) {
          await hook.onBeforeExtract(data);
        }
        break;
      case 'after_extract':
        if (hook.onAfterExtract) {
          await hook.onAfterExtract(data);
        }
        break;
      case 'before_search':
        if (hook.onBeforeSearch) {
          await hook.onBeforeSearch(data);
        }
        break;
      case 'after_search':
        if (hook.onAfterSearch) {
          await hook.onAfterSearch(data);
        }
        break;
      case 'on_error':
        if (hook.onError) {
          await hook.onError(data);
        }
        break;
      case 'on_cache_hit':
        if (hook.onCacheHit) {
          await hook.onCacheHit(data);
        }
        break;
      case 'on_cache_miss':
        if (hook.onCacheMiss) {
          await hook.onCacheMiss(data);
        }
        break;
      case 'on_file_read':
        if (hook.onFileRead) {
          await hook.onFileRead(data);
        }
        break;
    }
  }

  // @contract: getHooks(hookName: HookName) => IHook[]
  // @step: [返回 Hook 列表] 返回该 Hook 点的所有 Hook
  getHooks(hookName: HookName): IHook[] {
    return this.hooks.get(hookName) || [];
  }

  // @contract: clear() => void
  // @step: [清空所有 Hook] 清空所有注册的 Hook
  clear(): void {
    this.hooks.clear();
    console.log('[HookManager] 已清空所有 Hook');
  }
}
