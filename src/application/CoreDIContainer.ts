/**
 * @intent
 * 核心依赖注入容器，管理所有适配器共享的核心依赖：data 层实现（FileSystemRepository、CacheRepositoryImpl、CodeParserRepositoryImpl）+ 基础用例。
 * agent 域（agent 发现、守卫开关）已随 pi 适配层入档（pi-removal），本容器不再组装。
 * 容器只包含纯粹的核心依赖，不包含任何适配器特定的依赖。
 * 边界：不 import data 层实现以外的适配器特定模块；MCP/CLI 容器经此获取共享用例。
 * 验收条件：
 * - checkFileSizeUseCase / traceDependencyChainUseCase / projectIntentUseCase / listFolderIntentsUseCase 均可实例化
 * - 无 agentRepo / guardToggleStore / guardToggleService 残留引用
 */




import { IFileRepository } from '../data/repositories/IFileRepository';
import { ICodeParserRepository } from '../data/repositories/ICodeParserRepository';
import { ICacheRepository } from '../data/repositories/ICacheRepository';
import { FileSystemRepository } from '../data/services/fileSystem/FileSystemRepository';
import { CacheRepositoryImpl } from '../data/services/cache/CacheRepositoryImpl';
import { CodeParserRepositoryImpl } from '../data/services/codeParser/CodeParserRepositoryImpl';

// @warn: ConfigManager 已废弃
import * as UseCases from './useCases';

// @intent: 核心依赖注入容器，管理所有适配器共享的核心依赖
// @note: 这个容器只包含纯粹的核心依赖，不包含任何适配器特定的依赖
// @note: 所有适配器（MCP、CLI）都应该使用这个容器来初始化核心依赖

export class CoreDIContainer {
  // ==================== 数据层依赖 ====================
  // @note: 数据仓库接口的实现，所有适配器共享

  public fileRepo: IFileRepository;
  public cacheRepo: ICacheRepository;
  public parserRepo: ICodeParserRepository;

  // @warn: ConfigManager 已废弃（核心应用层依赖）

  // ==================== 基础用例 ====================
  // @note: 原子化的基础用例，提供最小粒度的业务操作
  // @note: 这些用例不依赖任何适配器，可以被所有适配器复用

  // @warn: extractFullContextUseCase 已废弃

  // 分析用例
  public checkFileSizeUseCase: UseCases.CheckFileSizeUseCase;

  // 缓存管理用例

  // 能力清单生成用例
  public traceDependencyChainUseCase: UseCases.TraceDependencyChainUseCase;

  // 投射意图用例
  public projectIntentUseCase: UseCases.ProjectIntentUseCase;

  // 文件夹意图清单用例
  public listFolderIntentsUseCase: UseCases.ListFolderIntentsUseCase;

  // @warn: 意图包相关（GenerateIntentPackage/MaintainIntentPackages/IntentPackageQueryService）已废弃

  constructor() {
    // ==================== 初始化数据层 ====================
    this.fileRepo = new FileSystemRepository();
    this.cacheRepo = CacheRepositoryImpl.getInstance();
    this.parserRepo = new CodeParserRepositoryImpl();

    // @warn: ConfigManager 初始化已废弃

    // ==================== 初始化基础用例 ====================
    // @note: 用例的依赖注入，确保依赖方向正确：用例 → 仓库

    // 上下文提取用例
    // @warn: extractFullContextUseCase 初始化已废弃

    // 分析用例
    this.checkFileSizeUseCase = new UseCases.CheckFileSizeUseCase(
      this.fileRepo,
      this.parserRepo
    );

    // 能力清单生成用例
    this.traceDependencyChainUseCase = new UseCases.TraceDependencyChainUseCase(
      this.parserRepo,
      this.fileRepo
    );

    // 投射意图用例
    this.projectIntentUseCase = new UseCases.ProjectIntentUseCase(
      this.fileRepo
    );

    // 文件夹意图清单用例
    this.listFolderIntentsUseCase = new UseCases.ListFolderIntentsUseCase(
      this.fileRepo
    );

    // @warn: 意图包初始化（GenerateIntentPackage/MaintainIntentPackages 等）已废弃
  }

}
