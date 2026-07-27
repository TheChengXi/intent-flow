import { CoreDIContainer } from '../../application/CoreDIContainer';
import { CheckFileSizeUseCase } from '../../application/useCases/CheckFileSizeUseCase';
// @warn: TraceDependencyChainUseCase 已废弃
import { ProjectIntentUseCase } from '../../application/useCases/ProjectIntentUseCase';

/**
 * @intent
 * CLI 适配器的依赖注入容器，在 CoreDIContainer 之上注入 CLI 特定依赖。
 * 屏蔽：CoreDIContainer 的实例化细节对命令透明
 */

export class CliDIContainer {
  private static instance: CliDIContainer;

  // ==================== 核心依赖容器 ====================
  private core: CoreDIContainer;

  private constructor() {
    // @step: 初始化核心依赖容器
    this.core = new CoreDIContainer();
  }

  /**
   * @contract
   * 获取 CliDIContainer 单例。
   * 输入：无
   * 输出：CliDIContainer - 全局唯一的 CLI 容器实例
   * 副作用：首次调用时创建实例
   * @boundary
   * - 全局只存在一个实例
   * - 线程安全（同步初始化，单线程环境）
   */
  static getInstance(): CliDIContainer {
    if (!CliDIContainer.instance) {
      CliDIContainer.instance = new CliDIContainer();
    }
    return CliDIContainer.instance;
  }

  // ==================== UseCase 访问器 ====================

  /** @contract 获取 CheckFileSizeUseCase，用于文件大小检查 */
  get checkFileSizeUseCase(): CheckFileSizeUseCase {
    return this.core.checkFileSizeUseCase;
  }

  // @warn: traceDependencyChainUseCase 已废弃

  /** @contract 获取 ProjectIntentUseCase，用于写入 @intent */
  get projectIntentUseCase(): ProjectIntentUseCase {
    return this.core.projectIntentUseCase;
  }

  /** @contract 获取 ListFolderIntentsUseCase，用于文件夹意图扫描 */
  get listFolderIntentsUseCase(): import('../../application/useCases/ListFolderIntentsUseCase').ListFolderIntentsUseCase {
    return this.core.listFolderIntentsUseCase;
  }
}
