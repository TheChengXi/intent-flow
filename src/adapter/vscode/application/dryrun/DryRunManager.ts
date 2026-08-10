import { DryRunUseCase } from '../../../../application/useCases/DryRunUseCase';
import { VSCodeDIContainer } from '../../VSCodeDIContainer';

/**
 * @intent
 * Dry Run 模式的 adapter 门面：以单例运行，公开 API（toggle/isEnabled/intercept/onStateChange/onIntercept/onError）委托给 DryRunUseCase。UI 组件（OutputChannel/StatusBar/ToggleCommand）依赖本类稳定 API 面，保持零改动。
 * 边界：本类不持有业务状态、不触碰 data 层；业务逻辑与监听器机制全部在 DryRunUseCase 中。
 * 验收条件：
 * - 不 import 任何 data 层模块（架构检查 grep 无结果）
 * - 公开 API 与重构前完全一致
 */
export class DryRunManager {
  private static instance: DryRunManager;
  private useCase: DryRunUseCase;

  private constructor() {
    // @note: UseCase 经 VSCodeDIContainer 装配（单例容器），业务状态与监听器机制全部在 UseCase 内
    this.useCase = VSCodeDIContainer.getInstance().dryRunUseCase;
  }

  // @contract: getInstance() => DryRunManager
  // @step: [单例模式] 如果实例不存在，创建新实例
  // @step: [返回实例] 返回单例实例
  // @boundary: 全局只有一个实例
  static getInstance(): DryRunManager {
    if (!DryRunManager.instance) {
      DryRunManager.instance = new DryRunManager();
    }
    return DryRunManager.instance;
  }

  // @contract: toggle() => boolean
  // @step: [委托 UseCase] 切换状态并返回新状态
  toggle(): boolean {
    return this.useCase.toggle();
  }

  // @contract: isEnabled() => boolean
  // @step: [委托 UseCase] 返回当前 enabled 状态
  isEnabled(): boolean {
    return this.useCase.isEnabled();
  }

  // @contract: intercept(role: string, systemPrompt: string, userMessage: string) => Promise<void>
  // @step: [委托 UseCase] 统计→建记录→保存→通知；失败降级触发 errorListeners
  async intercept(role: string, systemPrompt: string, userMessage: string): Promise<void> {
    return this.useCase.intercept(role, systemPrompt, userMessage);
  }

  // @contract: onStateChange(callback: (enabled: boolean) => void) => void
  // @step: [委托 UseCase] 注册状态变化监听器
  onStateChange(callback: (enabled: boolean) => void): void {
    this.useCase.onStateChange(callback);
  }

  // @contract: onIntercept(callback: (filePath: string) => void) => void
  // @step: [委托 UseCase] 注册拦截成功监听器
  onIntercept(callback: (filePath: string) => void): void {
    this.useCase.onIntercept(callback);
  }

  // @contract: onError(callback: (error: Error, content?: string) => void) => void
  // @step: [委托 UseCase] 注册错误监听器
  onError(callback: (error: Error, content?: string) => void): void {
    this.useCase.onError(callback);
  }
}
