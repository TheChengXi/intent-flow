import { HookName, HookDataMap } from './HookTypes';

// @intent: Hook 接口，定义 Hook 的基本结构

export interface IHook {
  name: string;

  // before_extract Hook
  onBeforeExtract?(data: HookDataMap['before_extract']): Promise<void>;

  // after_extract Hook
  onAfterExtract?(data: HookDataMap['after_extract']): Promise<void>;

  // before_search Hook
  onBeforeSearch?(data: HookDataMap['before_search']): Promise<void>;

  // after_search Hook
  onAfterSearch?(data: HookDataMap['after_search']): Promise<void>;

  // on_error Hook
  onError?(data: HookDataMap['on_error']): Promise<void>;

  // on_cache_hit Hook
  onCacheHit?(data: HookDataMap['on_cache_hit']): Promise<void>;

  // on_cache_miss Hook
  onCacheMiss?(data: HookDataMap['on_cache_miss']): Promise<void>;

  // on_file_read Hook
  onFileRead?(data: HookDataMap['on_file_read']): Promise<void>;
}
