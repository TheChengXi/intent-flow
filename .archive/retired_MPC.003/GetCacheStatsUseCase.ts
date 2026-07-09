import { IUseCase } from './IUseCase';
import { CacheStats } from '../../data/entities/CacheStats';
import { ICacheRepository } from '../../data/repositories/ICacheRepository';

// @intent: 获取缓存统计用例，返回缓存使用情况

export class GetCacheStatsUseCase implements IUseCase<void, CacheStats> {
  constructor(private cacheRepo: ICacheRepository) {}

  // @contract: execute() => Promise<CacheStats>
  // @step: [获取统计] 调用 cacheRepo.getStats() 获取缓存统计
  // @step: [返回结果] 返回 CacheStats
  async execute(): Promise<CacheStats> {
    return await this.cacheRepo.getStats();
  }
}
