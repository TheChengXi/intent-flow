import { describe, it, expect, vi } from 'vitest';
import { SearchIntentPackagesTool } from './SearchIntentPackagesTool';
import { IntentPackageQueryService } from '../../../application/services/IntentPackageQueryService';
import { IIntentPackageRepository } from '../../../data/repositories/IIntentPackageRepository';

describe('SearchIntentPackagesTool', () => {
  it('返回检索结果（空结果数组）', async () => {
    const mockRepo: IIntentPackageRepository = {
      save: vi.fn(), load: vi.fn(),
      list: vi.fn().mockResolvedValue([]),
      listByFolder: vi.fn(), delete: vi.fn(), exists: vi.fn(),
    };
    const service = new IntentPackageQueryService(mockRepo);
    const tool = new SearchIntentPackagesTool(service);

    const result = await tool.execute({ query: 'test' });
    expect(result).toHaveProperty('results');
    expect(Array.isArray(result.results)).toBe(true);
  });
});
