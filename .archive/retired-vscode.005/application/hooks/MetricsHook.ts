import { IHook } from './IHook';
import {
  AfterExtractData,
  AfterSearchData,
  OnCacheHitData,
  OnCacheMissData
} from './HookTypes';

/**
 * @intent
 * 自动收集提取和搜索操作的性能指标（耗时、命中率），后续可接入外部监控。
 * 边界：extractTimes 和 searchTimes 数组会无限增长，需要定期裁剪
 */

export class MetricsHook implements IHook {
  name = 'MetricsHook';

  private extractTimes: number[] = [];
  private searchTimes: number[] = [];
  private cacheHits: number = 0;
  private cacheMisses: number = 0;

  async onAfterExtract(data: AfterExtractData): Promise<void> {
    this.extractTimes.push(data.duration);

    if (this.extractTimes.length % 100 === 0) {
      this.logExtractStats();
    }
  }

  async onAfterSearch(data: AfterSearchData): Promise<void> {
    this.searchTimes.push(data.duration);

    if (this.searchTimes.length % 100 === 0) {
      this.logSearchStats();
    }
  }

  async onCacheHit(data: OnCacheHitData): Promise<void> {
    this.cacheHits++;
  }

  async onCacheMiss(data: OnCacheMissData): Promise<void> {
    this.cacheMisses++;
  }

  private logExtractStats(): void {
    const stats = this.calculateStats(this.extractTimes);
    console.log(`[MetricsHook] 提取性能统计 (${this.extractTimes.length} 次):`, stats);
  }

  private logSearchStats(): void {
    const stats = this.calculateStats(this.searchTimes);
    console.log(`[MetricsHook] 搜索性能统计 (${this.searchTimes.length} 次):`, stats);
  }

  private calculateStats(times: number[]): {
    p50: number;
    p95: number;
    p99: number;
    avg: number;
  } {
    if (times.length === 0) {
      return { p50: 0, p95: 0, p99: 0, avg: 0 };
    }

    const sorted = [...times].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(times.length * 0.5)];
    const p95 = sorted[Math.floor(times.length * 0.95)];
    const p99 = sorted[Math.floor(times.length * 0.99)];
    const avg = times.reduce((sum, t) => sum + t, 0) / times.length;

    return {
      p50: Math.round(p50),
      p95: Math.round(p95),
      p99: Math.round(p99),
      avg: Math.round(avg)
    };
  }

  getCacheHitRate(): number {
    const total = this.cacheHits + this.cacheMisses;
    if (total === 0) {
      return 0;
    }
    return (this.cacheHits / total) * 100;
  }

  getStats(): {
    extract: { p50: number; p95: number; p99: number; avg: number };
    search: { p50: number; p95: number; p99: number; avg: number };
    cacheHitRate: number;
    cacheHits: number;
    cacheMisses: number;
  } {
    return {
      extract: this.calculateStats(this.extractTimes),
      search: this.calculateStats(this.searchTimes),
      cacheHitRate: this.getCacheHitRate(),
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses
    };
  }

  reset(): void {
    this.extractTimes = [];
    this.searchTimes = [];
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }
}
