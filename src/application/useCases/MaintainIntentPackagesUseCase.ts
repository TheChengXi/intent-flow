import { IIntentPackageRepository } from '../../data/repositories/IIntentPackageRepository';
import { IntentHashService } from '../../data/services/intentPackage/IntentHashService';
import { IGenerateIntentPackageUseCase, IntentFileIntent } from './GenerateIntentPackageUseCase';
import { ListFolderIntentsUseCase } from './ListFolderIntentsUseCase';
import * as path from 'path';

/**
 * @intent
 * 增量维护用例。所有"是否覆盖包文件"的决策者。
 * 检测 @intent 变更 → 调用 GenerateIntentPackageUseCase 重算
 * → 决策原子覆盖 / pinned 跳过 / LLM 失败降级保留。
 */

export interface MaintainIntentPackageInput {
  folderPath: string;
  changedFiles?: string[];
}

export interface MaintenanceResult {
  action: 'no_change' | 'updated' | 'pinned_skipped' | 'llm_failed_kept_old' | 'deprecated';
  packageName: string;
  message: string;
}

export class MaintainIntentPackagesUseCase {
  private generateUseCase: IGenerateIntentPackageUseCase;
  private repo: IIntentPackageRepository;
  private hashService: IntentHashService;
  private listFolderIntentsUseCase: ListFolderIntentsUseCase;

  constructor(
    generateUseCase: IGenerateIntentPackageUseCase,
    repo: IIntentPackageRepository,
    hashService: IntentHashService,
    listFolderIntentsUseCase: ListFolderIntentsUseCase
  ) {
    this.generateUseCase = generateUseCase;
    this.repo = repo;
    this.hashService = hashService;
    this.listFolderIntentsUseCase = listFolderIntentsUseCase;
  }

  // @contract: execute(input) => MaintenanceResult
  // @step: [提取包名] 从文件夹路径提取最后一个目录名为包名
  // @step: [加载现有包] 从仓库加载现有 IntentPackage（可能为 null）
  // @step: [计算 hash] 对文件夹计算当前 hash
  // @step: [对比 hash] 如果 hash 不变 → no_change
  // @step: [检查 pinned] 如果 hash 变但 pinned → pinned_skipped
  // @step: [调用 LLM] hash 变且未 pinned → 收集 intents + 调用 generateUseCase
  // @step: [覆盖/降级] LLM 成功→保存更新；LLM 失败→保留旧包+告警
  // @boundary: 包不存在时视为全新包（跳过 hash 对比，直接生成）
  // @boundary: LLM 调用失败不中断流程，降级为 llm_failed_kept_old
  async execute(input: MaintainIntentPackageInput): Promise<MaintenanceResult> {
    const packageName = path.basename(input.folderPath);

    // @step: 加载现有包
    const existing = await this.repo.load(packageName);

    // @step: 计算当前 hash
    const currentHash = await this.hashService.calcHashForFolder(input.folderPath);

    // @step: 对比 hash
    if (existing && existing.hash === currentHash) {
      return {
        action: 'no_change',
        packageName,
        message: '未检测到 @intent 变更',
      };
    }

    if (existing?.pinned) {
      return {
        action: 'pinned_skipped',
        packageName,
        message: '包已锁定（pinned），@intent 变更未自动更新',
      };
    }

    // @step: 收集 intents — 调用 ListFolderIntentsUseCase 获取文件夹内所有文件的 @intent
    const folderIntents = await this.listFolderIntentsUseCase.execute(input.folderPath);

    // @step: 将 FileIntent[] 转为 IntentFileIntent[]（过滤掉无 @intent 的文件）
    const intents: IntentFileIntent[] = folderIntents.files
      .filter(f => f.intent !== null)
      .map(f => ({
        filePath: f.file,
        intent: f.intent!,
      }));

    // @step: 调用 GenerateIntentPackageUseCase
    try {
      const newPackage = await this.generateUseCase.execute({
        folderName: packageName,
        intents,
        dependencyEdges: [],
      });

      // @step: 保存新包
      await this.repo.save(newPackage);

      return {
        action: 'updated',
        packageName,
        message: '意图包已更新',
      };
    } catch (err) {
      return {
        action: 'llm_failed_kept_old',
        packageName,
        message: `LLM 调用失败，保留旧包: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
