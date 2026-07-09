import { IUseCase } from './IUseCase';
import { ICacheRepository } from '../../data/repositories/ICacheRepository';

// @intent: 清空缓存用例，清空所有缓存

export class ClearCacheUseCase implements IUseCase<void, void> {
  constructor(private cacheRepo: ICacheRepository) {}

  // @contract: execute() => Promise<void>
  // @step: [清空缓存] 调用 cacheRepo.clear() 清空所有缓存
  async execute(): Promise<void> {
    await this.cacheRepo.clear();
    console.log('[ClearCacheUseCase] 已清空所有缓存');
  }
}
