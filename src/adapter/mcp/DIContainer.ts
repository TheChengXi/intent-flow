import { CoreDIContainer } from '../../application/CoreDIContainer';
import { HookManager } from '../../application/hooks/HookManager';
import { CacheHook } from '../../application/hooks/CacheHook';
import { LoggingHook } from '../../application/hooks/LoggingHook';
import { MetricsHook } from '../../application/hooks/MetricsHook';
import * as Tools from './tools';

/**
 * @intent
 * MCP 适配器的依赖注入容器，在 CoreDIContainer 之上注入 MCP 特定依赖（7 个 Tool + HookManager）。
 * 屏蔽：CoreDIContainer 的实例化细节对 Tools 透明
 */
// @note: HookManager 是 MCP 适配器的专属基础设施，不放在 CoreDIContainer 中

export class DIContainer {
  private static instance: DIContainer;

  // ==================== 核心依赖容器 ====================
  // @note: 所有核心依赖（数据层、核心应用层、基础用例）都由 CoreDIContainer 管理
  private core: CoreDIContainer;

  // ==================== MCP 特定依赖 ====================
  // @note: HookManager 只在 MCP 适配器中使用，不污染 CoreDIContainer
  public hookManager: HookManager;

  // @note: MCP Tools 封装基础用例，提供 MCP 协议接口
  public checkFileSizeTool: Tools.CheckFileSizeTool;
  public traceDependencyChainTool: Tools.TraceDependencyChainTool;
  public projectIntentTool: Tools.ProjectIntentTool;
  public getIntentPackageTool: Tools.GetIntentPackageTool;
  public listIntentPackagesTool: Tools.ListIntentPackagesTool;
  public searchIntentPackagesTool: Tools.SearchIntentPackagesTool;
  public listFolderIntentsTool: Tools.ListFolderIntentsTool;

  private constructor() {
    // 初始化核心依赖容器
    this.core = new CoreDIContainer();

    // 初始化 MCP 专属的 HookManager + 注册 Hooks
    this.hookManager = new HookManager();
    this.registerHooks();

    // 初始化 MCP Tools（使用核心容器中的用例和 MCP 的 HookManager）
    this.checkFileSizeTool = new Tools.CheckFileSizeTool(
      this.core.checkFileSizeUseCase
    );
    this.traceDependencyChainTool = new Tools.TraceDependencyChainTool(
      this.core.traceDependencyChainUseCase
    );
    this.projectIntentTool = new Tools.ProjectIntentTool(
      this.core.projectIntentUseCase
    );
    this.getIntentPackageTool = new Tools.GetIntentPackageTool(
      this.core.intentPackageQueryService
    );
    this.listIntentPackagesTool = new Tools.ListIntentPackagesTool(
      this.core.intentPackageQueryService
    );
    this.searchIntentPackagesTool = new Tools.SearchIntentPackagesTool(
      this.core.intentPackageQueryService
    );
    this.listFolderIntentsTool = new Tools.ListFolderIntentsTool(
      this.core.listFolderIntentsUseCase
    );
  }

  // @contract: registerHooks() => void
  // @step: [读取配置] 从 ConfigManager 读取启用的 Hooks 列表
  // @step: [注册 CacheHook] 如果配置中包含 'cache'，注册缓存 Hook
  // @step: [注册 LoggingHook] 如果配置中包含 'logging'，注册日志 Hook
  // @step: [注册 MetricsHook] 如果配置中包含 'metrics'，注册性能监控 Hook
  // @boundary: 当配置为空时，不注册任何 Hook
  private registerHooks(): void {
    const config = this.core.configManager.get<string[]>('hooks.enabled') || [];

    // 注册缓存 Hook
    if (config.includes('cache')) {
      const cacheHook = new CacheHook(this.core.cacheRepo);
      this.hookManager.register('after_extract', cacheHook);
      this.hookManager.register('after_search', cacheHook);
    }

    // 注册日志 Hook
    if (config.includes('logging')) {
      const loggingHook = new LoggingHook();
      this.hookManager.register('before_extract', loggingHook);
      this.hookManager.register('after_extract', loggingHook);
      this.hookManager.register('before_search', loggingHook);
      this.hookManager.register('after_search', loggingHook);
      this.hookManager.register('on_error', loggingHook);
    }

    // 注册性能监控 Hook
    if (config.includes('metrics')) {
      const metricsHook = new MetricsHook();
      this.hookManager.register('after_extract', metricsHook);
      this.hookManager.register('after_search', metricsHook);
      this.hookManager.register('on_cache_hit', metricsHook);
      this.hookManager.register('on_cache_miss', metricsHook);
    }
  }

  // @contract: getInstance() => DIContainer
  // @step: [单例模式] 如果实例不存在，创建新实例
  // @step: [返回实例] 返回单例实例
  // @boundary: 全局只有一个实例
  static getInstance(): DIContainer {
    if (!DIContainer.instance) {
      DIContainer.instance = new DIContainer();
    }
    return DIContainer.instance;
  }

  // @contract: getAllTools() => MCPToolHandler[]
  // @step: [返回工具列表] 返回所有 MCP Tools
  // @boundary: 返回的工具列表现在是 7 个工具
  getAllTools() {
    return [
      this.checkFileSizeTool,
      this.traceDependencyChainTool,
      this.projectIntentTool,
      this.getIntentPackageTool,
      this.listIntentPackagesTool,
      this.searchIntentPackagesTool,
      this.listFolderIntentsTool
    ];
  }

  // @contract: getCore() => CoreDIContainer
  // @step: [返回核心容器] 返回核心依赖容器
  // @note: 提供对核心依赖的访问（用于测试或特殊场景）
  getCore(): CoreDIContainer {
    return this.core;
  }
}
