/**
 * @intent
 * 核心依赖注入容器，管理所有适配器共享的核心依赖。checkFileSizeUseCase 注入 IFileRepository + ICodeParserRepository 两个依赖。
 */

import { IFileRepository } from '../data/repositories/IFileRepository';
import { ICodeParserRepository } from '../data/repositories/ICodeParserRepository';
import { ICacheRepository } from '../data/repositories/ICacheRepository';
import { FileSystemRepository } from '../data/services/fileSystem/FileSystemRepository';
import { CacheRepositoryImpl } from '../data/services/cache/CacheRepositoryImpl';
import { CodeParserRepositoryImpl } from '../data/services/codeParser/CodeParserRepositoryImpl';

import { ConfigManager } from './config/ConfigManager';
import * as UseCases from './useCases';

// @intent: 核心依赖注入容器，管理所有适配器共享的核心依赖
// @note: 这个容器只包含纯粹的核心依赖，不包含任何适配器特定的依赖
// @note: 所有适配器（MCP、VSCode、CLI）都应该使用这个容器来初始化核心依赖

export class CoreDIContainer {
  // ==================== 数据层依赖 ====================
  // @note: 数据仓库接口的实现，所有适配器共享

  public fileRepo: IFileRepository;
  public cacheRepo: ICacheRepository;
  public parserRepo: ICodeParserRepository;

  // ==================== 核心应用层依赖 ====================
  // @note: 核心应用层的管理器和配置，所有适配器共享

  public configManager: ConfigManager;

  // ==================== 基础用例 ====================
  // @note: 原子化的基础用例，提供最小粒度的业务操作
  // @note: 这些用例不依赖任何适配器，可以被所有适配器复用

  // @warn: extractFullContextUseCase 已废弃

  // 分析用例
  public checkFileSizeUseCase: UseCases.CheckFileSizeUseCase;

  // 缓存管理用例

  // 能力清单生成用例
  public analyzeCallGraphUseCase: UseCases.AnalyzeCallGraphUseCase;
  // @warn: traceDependencyChainUseCase 已废弃

  // 投射意图用例
  public projectIntentUseCase: UseCases.ProjectIntentUseCase;

  // 文件夹意图清单用例
  public listFolderIntentsUseCase: UseCases.ListFolderIntentsUseCase;

  // 意图文件投射用例（将 @intent 实时映射到 .cdd/intents/ 目录树）
  public projectIntentsToFilesUseCase: UseCases.ProjectIntentsToFilesUseCase;

  // @warn: 意图包相关（GenerateIntentPackage/MaintainIntentPackages/IntentPackageQueryService）已废弃

  constructor() {
    // ==================== 初始化数据层 ====================
    this.fileRepo = new FileSystemRepository();
    this.cacheRepo = CacheRepositoryImpl.getInstance();
    this.parserRepo = new CodeParserRepositoryImpl();

    // ==================== 初始化核心应用层 ====================
    this.configManager = ConfigManager.getInstance();

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
    this.analyzeCallGraphUseCase = new UseCases.AnalyzeCallGraphUseCase(
      this.fileRepo,
      this.parserRepo
    );
    // @warn: traceDependencyChainUseCase 初始化已废弃

    // 投射意图用例
    this.projectIntentUseCase = new UseCases.ProjectIntentUseCase(
      this.fileRepo
    );

    // 文件夹意图清单用例
    this.listFolderIntentsUseCase = new UseCases.ListFolderIntentsUseCase(
      this.fileRepo
    );

    // 意图文件投射用例
    this.projectIntentsToFilesUseCase = new UseCases.ProjectIntentsToFilesUseCase(
      this.fileRepo
    );

    // @warn: 意图包初始化（GenerateIntentPackage/MaintainIntentPackages 等）已废弃
  }

}
