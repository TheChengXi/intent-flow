import { describe, it, expect, vi, beforeEach } from 'vitest';
import { IntentPackageQueryService } from './IntentPackageQueryService';
import { IIntentPackageRepository } from '../../data/repositories/IIntentPackageRepository';
import { IntentPackage } from '../../data/entities/IntentPackage';

function samplePkg(name: string, overrides?: Partial<IntentPackage>): IntentPackage {
  return {
    packageName: name,
    summary: `摘要: ${name}`,
    groups: [
      { name: '组A', intent: '组A', files: [{ path: `${name}/a.ts`, intent: 'A' }] },
    ],
    crossRefs: [],
    hash: 'h',
    pinned: false,
    deprecated: false,
    embedding: [],
    ...overrides,
  };
}

describe('IntentPackageQueryService', () => {
  let mockRepo: IIntentPackageRepository;
  let service: IntentPackageQueryService;

  beforeEach(() => {
    mockRepo = {
      save: vi.fn(),
      load: vi.fn(),
      list: vi.fn(),
      listByFolder: vi.fn(),
      delete: vi.fn(),
      exists: vi.fn(),
    };
    service = new IntentPackageQueryService(mockRepo);
  });

  describe('getPackage', () => {
    it('返回正常包的公开视图', async () => {
      vi.mocked(mockRepo.load).mockResolvedValue(samplePkg('auth'));

      const view = await service.getPackage('auth');
      expect(view).not.toBeNull();
      expect(view!.packageName).toBe('auth');
      expect(view!.summary).toBe('摘要: auth');
      // 确保内部字段被屏蔽
      expect((view as any).hash).toBeUndefined();
      expect((view as any).pinned).toBeUndefined();
      expect((view as any).deprecated).toBeUndefined();
      expect((view as any).embedding).toBeUndefined();
    });

    it('deprecated 包返回 null', async () => {
      vi.mocked(mockRepo.load).mockResolvedValue(samplePkg('old', { deprecated: true }));

      const view = await service.getPackage('old');
      expect(view).toBeNull();
    });

    it('不存在的包返回 null', async () => {
      vi.mocked(mockRepo.load).mockResolvedValue(null);

      const view = await service.getPackage('ghost');
      expect(view).toBeNull();
    });
  });

  describe('listPackages', () => {
    it('默认排除 deprecated 包', async () => {
      vi.mocked(mockRepo.list).mockResolvedValue(['auth', 'notification', 'old']);
      vi.mocked(mockRepo.load).mockImplementation(async (name) => {
        if (name === 'old') return samplePkg('old', { deprecated: true });
        return samplePkg(name);
      });

      const names = await service.listPackages();
      expect(names).not.toContain('old');
      expect(names).toContain('auth');
      expect(names).toContain('notification');
    });

    it('includeDeprecated 时包含已废弃包', async () => {
      vi.mocked(mockRepo.list).mockResolvedValue(['auth', 'old']);
      vi.mocked(mockRepo.load).mockImplementation(async (name) => {
        if (name === 'old') return samplePkg('old', { deprecated: true });
        return samplePkg(name);
      });

      const names = await service.listPackages(true);
      expect(names).toContain('old');
    });
  });

  describe('searchPackages', () => {
    it('无 LLM 时返回空数组', async () => {
      const svc = new IntentPackageQueryService(mockRepo);
      const results = await svc.searchPackages('anything');
      expect(results).toEqual([]);
    });
  });
});
