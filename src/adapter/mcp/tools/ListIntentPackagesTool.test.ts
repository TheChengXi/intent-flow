import { describe, it, expect, vi } from 'vitest';
import { ListIntentPackagesTool } from './ListIntentPackagesTool';
import { IntentPackageQueryService } from '../../../application/services/IntentPackageQueryService';
import { IIntentPackageRepository } from '../../../data/repositories/IIntentPackageRepository';

describe('ListIntentPackagesTool', () => {
  it('返回包名列表', async () => {
    const mockRepo: IIntentPackageRepository = {
      save: vi.fn(), load: vi.fn().mockResolvedValue({
        packageName: 'a', summary: '', groups: [], crossRefs: [],
        hash: '', pinned: false, deprecated: false, embedding: [],
      }),
      list: vi.fn().mockResolvedValue(['auth', 'notif']),
      listByFolder: vi.fn(), delete: vi.fn(), exists: vi.fn(),
    };
    const service = new IntentPackageQueryService(mockRepo);
    const tool = new ListIntentPackagesTool(service);

    const result = await tool.execute({});
    expect(result.packages).toContain('auth');
  });
});
