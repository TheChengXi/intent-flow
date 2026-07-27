import { CoreDIContainer } from '../../application/CoreDIContainer';
// @warn: VSCodeConfigAdapter 已废弃
// @warn: VSCodeAIService 已废弃（转至 .archive/retired-vscode.005）

// @intent: VSCode 适配器的依赖注入容器
// @note: 使用 CoreDIContainer 管理核心依赖，添加 VSCode 特定的依赖

export class VSCodeDIContainer {
  private static instance: VSCodeDIContainer;

  // ==================== 核心依赖容器 ====================
  // @note: 所有核心依赖（数据层、核心应用层、基础用例）都由 CoreDIContainer 管理
  private core: CoreDIContainer;

  // @warn: configAdapter 已废弃（VSCodeConfigAdapter 已移至 archive）

  // ==================== VSCode 特定用例（未来） ====================
  // @note: 高级用例将在阶段 3 添加
  // public compileCodeUseCase: CompileCodeUseCase;
  // public reviewCodeUseCase: ReviewCodeUseCase;
  // ...

  private constructor() {
    // 初始化核心依赖容器
    this.core = new CoreDIContainer();

    // @warn: configAdapter 初始化已废弃
    // @warn: aiService 已废弃（VSCodeAIService 已移至 .archive/retired-vscode.005）

    // 未来：初始化 VSCode 特定用例
    // this.compileCodeUseCase = new CompileCodeUseCase(
    //   this.core.extractFullContextUseCase,
    //   this.aiService,
    //   this.core.fileRepo
    // );
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
