import { DryRunConfig, createDefaultConfig } from '../../../../data/entities/DryRunConfig';
import { DryRunRecord, createDryRunRecord } from '../../../../data/entities/DryRunRecord';
import { DryRunRepository } from '../../../../data/repositories/DryRunRepository';
import { DryRunStatisticsService } from '../../../../data/services/DryRunStatisticsService';

/**
 * @intent
 * Dry Run 模式的核心状态管理器和拦截引擎。以单例模式运行，协调状态切换→请求拦截→文件保存→UI 通知的完整链路。
 * 边界：拦截操作异步执行不阻塞主流程；文件保存失败时通过监听器降级到控制台输出
 */
export class DryRunManager {
  private static instance: DryRunManager;
  private enabled: boolean = false;
  private config: DryRunConfig;
  private repository: DryRunRepository;
  private statisticsService: DryRunStatisticsService;
  private stateChangeListeners: Array<(enabled: boolean) => void> = [];
  private interceptListeners: Array<(filePath: string) => void> = [];
  private errorListeners: Array<(error: Error, content?: string) => void> = [];

  private constructor() {
    this.config = createDefaultConfig();
    this.repository = new DryRunRepository();
    this.statisticsService = new DryRunStatisticsService();
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
  // @step: [切换状态] 反转 enabled 状态
  // @step: [更新配置] 更新 config.enabled
  // @step: [通知监听器] 触发所有 stateChangeListeners
  // @step: [返回新状态] 返回切换后的状态
  toggle(): boolean {
    this.enabled = !this.enabled;
    this.config.enabled = this.enabled;

    // 通知所有监听器
    this.stateChangeListeners.forEach(listener => {
      try {
        listener(this.enabled);
      } catch (error) {
        console.error('[DryRunManager] Error in state change listener:', error);
      }
    });

    return this.enabled;
  }

  // @contract: isEnabled() => boolean
  // @step: [返回状态] 返回当前 enabled 状态
  isEnabled(): boolean {
    return this.enabled;
  }

  // @contract: intercept(role: string, systemPrompt: string, userMessage: string) => Promise<void>
  // @step: [计算统计信息] 调用 statisticsService.calculate 计算完整内容的统计信息
  // @step: [创建记录] 使用 createDryRunRecord 创建 DryRunRecord
  // @step: [异步保存] 调用 repository.save 保存记录
  // @step: [通知成功] 触发 interceptListeners 通知保存成功
  // @step: [错误处理] 如果保存失败，触发 errorListeners 并传递完整内容
  // @boundary: 文件保存操作异步执行，不阻塞主线程
  async intercept(role: string, systemPrompt: string, userMessage: string): Promise<void> {
    try {
      // 构建完整内容用于统计
      const fullContent = `${systemPrompt}\n\n${userMessage}`;

      // 计算统计信息
      const statistics = this.statisticsService.calculate(fullContent);

      // 创建记录
      const record = createDryRunRecord(role, systemPrompt, userMessage, statistics);

      // 异步保存
      const filePath = await this.repository.save(record, this.config.outputDir);

      // 通知监听器
      this.interceptListeners.forEach(listener => {
        try {
          listener(filePath);
        } catch (error) {
          console.error('[DryRunManager] Error in intercept listener:', error);
        }
      });
    } catch (error: unknown) {
      // 保存失败，触发错误监听器
      const fullContent = `# System Prompt\n\n${systemPrompt}\n\n# User Message\n\n${userMessage}`;
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.errorListeners.forEach(listener => {
        try {
          listener(errorObj, fullContent);
        } catch (err) {
          console.error('[DryRunManager] Error in error listener:', err);
        }
      });
    }
  }

  // @contract: onStateChange(callback: (enabled: boolean) => void) => void
  // @step: [注册监听器] 将 callback 添加到 stateChangeListeners
  onStateChange(callback: (enabled: boolean) => void): void {
    this.stateChangeListeners.push(callback);
  }

  // @contract: onIntercept(callback: (filePath: string) => void) => void
  // @step: [注册监听器] 将 callback 添加到 interceptListeners
  onIntercept(callback: (filePath: string) => void): void {
    this.interceptListeners.push(callback);
  }

  // @contract: onError(callback: (error: Error, content?: string) => void) => void
  // @step: [注册监听器] 将 callback 添加到 errorListeners
  onError(callback: (error: Error, content?: string) => void): void {
    this.errorListeners.push(callback);
  }
}
