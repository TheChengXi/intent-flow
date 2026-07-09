import { describe, it, expect, vi } from 'vitest';
import { GetIntentPackageTool } from './GetIntentPackageTool';
import { IntentPackageQueryService } from '../../../application/services/IntentPackageQueryService';
import { IIntentPackageRepository } from '../../../data/repositories/IIntentPackageRepository';

describe('GetIntentPackageTool', () => {
  it('包存在时返回公开视图', async () => {
    const mockRepo: IIntentPackageRepository = {
      save: vi.fn(), load: vi.fn().mockResolvedValue({
        packageName: 'auth', summary: '认证', groups: [], crossRefs: [],
        hash: 'h', pinned: false, deprecated: false, embedding: [],
      }),
      list: vi.fn(), listByFolder: vi.fn(), delete: vi.fn(), exists: vi.fn(),
    };
    const service = new IntentPackageQueryService(mockRepo);
    const tool = new GetIntentPackageTool(service);

    const result = await tool.execute({ name: 'auth' });
    expect(result).not.toHaveProperty('error');
    expect((result as any).packageName).toBe('auth');
  });

  it('包不存在时返回错误', async () => {
    const mockRepo: IIntentPackageRepository = {
      save: vi.fn(), load: vi.fn().mockResolvedValue(null),
      list: vi.fn(), listByFolder: vi.fn(), delete: vi.fn(), exists: vi.fn(),
    };
    const service = new IntentPackageQueryService(mockRepo);
    const tool = new GetIntentPackageTool(service);

    const result = await tool.execute({ name: 'ghost' });
    expect(result).toHaveProperty('error');
  });
});
