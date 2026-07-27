import { IHook } from './IHook';
import { ICacheRepository } from '../../data/repositories/ICacheRepository';
import { AfterExtractData, AfterSearchData } from './HookTypes';

/**
 * @intent
 * 在 after_extract / after_search Hook 点自动缓存结果，减少重复解析。
 * 边界：缓存键格式 "extract:filePath" / "search:filePath"
 */

export class CacheHook implements IHook {
  name = 'CacheHook';

  constructor(private cacheRepo: ICacheRepository) {}

  // @contract: onAfterExtract(data: AfterExtractData) => Promise<void>
  // @step: [缓存结果] 将提取结果缓存
  async onAfterExtract(data: AfterExtractData): Promise<void> {
    // 缓存提取结果
    const cacheKey = `extract:${data.filePath}`;
    await this.cacheRepo.set(cacheKey, data.result);
    console.log(`[CacheHook] 缓存提取结果: ${cacheKey}`);
  }

  // @contract: onAfterSearch(data: AfterSearchData) => Promise<void>
  // @step: [缓存结果] 将搜索结果缓存
  async onAfterSearch(data: AfterSearchData): Promise<void> {
    if (data.found && data.result) {
      const cacheKey = `${data.type}:${data.name}:${data.filePath}`;
      await this.cacheRepo.set(cacheKey, data.result);
      console.log(`[CacheHook] 缓存搜索结果: ${cacheKey}`);
    }
  }
}
