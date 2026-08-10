import { CoreDIContainer } from '../../application/CoreDIContainer';
import { DryRunUseCase } from '../../application/useCases/DryRunUseCase';
import { DryRunRepository } from '../../data/repositories/DryRunRepository';
import { DryRunStatisticsService } from '../../data/services/DryRunStatisticsService';
// @warn: VSCodeConfigAdapter 已废弃
// @warn: VSCodeAIService 已废弃（转至 .archive/retired-vscode.005）

/**
 * @intent
 * VSCode 适配器的依赖注入容器，装配 vscode 专属用例（当前：dryRunUseCase）。核心依赖（data 实现、基础用例）由 CoreDIContainer 管理。
 * 边界：dryRunUseCase 依赖 vscode 环境（其内部 DryRunRepository 使用 vscode API），不得迁入 CoreDIContainer，以免污染 MCP/CLI 等非 vscode 构建链。
 * 验收条件：
 * - dryRunUseCase 可经 getInstance() 获取，单例
 * - 容器仅新增 application/data 层依赖，无跨层
 */

export class VSCodeDIContainer {
  private static instance: VSCodeDIContainer;

  // ==================== 核心依赖容器 ====================
  // @note: 所有核心依赖（数据层、核心应用层、基础用例）都由 CoreDIContainer 管理
  private core: CoreDIContainer;

  // @warn: configAdapter 已废弃（VSCodeConfigAdapter 已移至 archive）

  // ==================== VSCode 特定用例 ====================
  // @note: DryRunUseCase 经此容器装配（单例），DryRunManager 从容器获取
  public dryRunUseCase: DryRunUseCase;

  private constructor() {
    // 初始化核心依赖容器
    this.core = new CoreDIContainer();

    // @warn: configAdapter 初始化已废弃
    // @warn: aiService 已废弃（VSCodeAIService 已移至 .archive/retired-vscode.005）

    // 装配 VSCode 特定用例：显式注入 data 实现（UseCase 构造器注入）
    this.dryRunUseCase = DryRunUseCase.createDryRunUseCase(
      new DryRunRepository(),
      new DryRunStatisticsService()
    );
  }

  // @contract: getInstance() => VSCodeDIContainer
  // @step: [单例模式] 如果实例不存在，创建新实例
  // @step: [返回实例] 返回单例实例
  // @boundary: 全局只有一个实例
  static getInstance(): VSCodeDIContainer {
    if (!VSCodeDIContainer.instance) {
      VSCodeDIContainer.instance = new VSCodeDIContainer();
    }
    return VSCodeDIContainer.instance;
  }

  // @contract: getCore() => CoreDIContainer
  // @step: [返回核心容器] 返回核心依赖容器
  // @note: 提供对核心依赖的访问（用于测试或特殊场景）
  getCore(): CoreDIContainer {
    return this.core;
  }

  // @contract: reset() => void
  // @step: [重置实例] 清空单例实例
  // @note: 用于测试场景，重置容器状态
  static reset(): void {
    VSCodeDIContainer.instance = null as any;
  }
}
