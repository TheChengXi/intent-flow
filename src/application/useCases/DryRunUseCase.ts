/**
 * @intent
 * Dry Run 模式业务逻辑的单一归属点：状态切换、拦截记录（统计→建记录→保存）、三类监听器通知，屏蔽 data 层实现与 vscode 环境。
 * 边界：intercept 保存失败不抛给调用方，降级触发 errorListeners 并携带完整降级内容；监听器抛错被隔离不影响主流程；默认配置 enabled=false。
 * 验收条件：
 * - toggle() 翻转状态、更新配置、通知 onStateChange 监听器，返回新状态
 * - intercept() 完成 统计→建记录→repository.save→通知 onIntercept 完整链路
 * - 保存失败时触发 onError（携带完整降级内容 # System Prompt 格式），不向上抛错
 */

import type { IDryRunRepository } from '../../data/repositories/IDryRunRepository';
import type { DryRunStatisticsService } from '../../data/services/DryRunStatisticsService';
import type { DryRunConfig } from '../../data/entities/DryRunConfig';
import type { DryRunRecord } from '../../data/entities/DryRunRecord';
import { createDefaultConfig } from '../../data/entities/DryRunConfig';
import { createDryRunRecord } from '../../data/entities/DryRunRecord';

// @entity: DryRunRecord
// 类型 re-export：adapter 层经 UseCase 获取实体类型，不直接 import data/entities
// @entity: DryRunConfig
export type { DryRunConfig, DryRunRecord };

/**
 * Dry Run 模式业务用例。
 * 依赖经 createDryRunUseCase() 注入：生产由 VSCodeDIContainer 装配（单例容器），测试直接注入 Fake。
 */
export class DryRunUseCase {
  private enabled: boolean = false;
  private config: DryRunConfig;
  private repository: IDryRunRepository;
  private statisticsService: DryRunStatisticsService;
  private stateChangeListeners: Array<(enabled: boolean) => void> = [];
  private interceptListeners: Array<(filePath: string) => void> = [];
  private errorListeners: Array<(error: Error, content?: string) => void> = [];

  private constructor(
    repository: IDryRunRepository,
    statisticsService: DryRunStatisticsService
  ) {
    this.config = createDefaultConfig();
    this.repository = repository;
    this.statisticsService = statisticsService;
  }

  // ==================== 构造 ====================

  // @contract: createDryRunUseCase(repository, statisticsService) => DryRunUseCase
  // 依赖注入点：测试传 Fake，生产由 VSCodeDIContainer 传真实实现
  static createDryRunUseCase(
    repository: IDryRunRepository,
    statisticsService: DryRunStatisticsService
  ): DryRunUseCase {
    return new DryRunUseCase(repository, statisticsService);
  }

  // ==================== 业务方法 ====================

  // @contract: toggle() => boolean
  // @step: [翻转状态] 反转 enabled 并同步 config.enabled
  // @step: [通知监听器] 触发 stateChangeListeners（监听器抛错被隔离）
  // @step: [返回新状态] 返回切换后的状态
  toggle(): boolean {
    this.enabled = !this.enabled;
    this.config.enabled = this.enabled;

    this.stateChangeListeners.forEach(listener => {
      try {
        listener(this.enabled);
      } catch (error) {
        console.error('[DryRunUseCase] Error in state change listener:', error);
      }
    });

    return this.enabled;
  }

  // @contract: isEnabled() => boolean
  // 返回当前 enabled 状态
  isEnabled(): boolean {
    return this.enabled;
  }

  // @contract: intercept(role, systemPrompt, userMessage) => Promise<void>
  // @step: [计算统计] statisticsService.calculate(fullContent)
  // @step: [创建记录] createDryRunRecord(role, systemPrompt, userMessage, statistics)
  // @step: [异步保存] repository.save(record, config.outputDir)
  // @step: [通知成功] 触发 interceptListeners（监听器抛错被隔离）
  // @step: [错误降级] 保存失败触发 errorListeners，携带完整降级内容，不向上抛错
  // @boundary: 文件保存异步执行；失败时调用方无感知，由监听器降级
  async intercept(
    role: string,
    systemPrompt: string,
    userMessage: string
  ): Promise<void> {
    try {
      const fullContent = `${systemPrompt}\n\n${userMessage}`;
      const statistics = this.statisticsService.calculate(fullContent);
      const record = createDryRunRecord(role, systemPrompt, userMessage, statistics);
      const filePath = await this.repository.save(record, this.config.outputDir);

      this.interceptListeners.forEach(listener => {
        try {
          listener(filePath);
        } catch (error) {
          console.error('[DryRunUseCase] Error in intercept listener:', error);
        }
      });
    } catch (error: unknown) {
      const fullContent = `# System Prompt\n\n${systemPrompt}\n\n# User Message\n\n${userMessage}`;
      const errorObj = error instanceof Error ? error : new Error(String(error));
      this.errorListeners.forEach(listener => {
        try {
          listener(errorObj, fullContent);
        } catch (err) {
          console.error('[DryRunUseCase] Error in error listener:', err);
        }
      });
    }
  }

  // @contract: onStateChange(callback) => void
  // 注册状态变化监听器
  onStateChange(callback: (enabled: boolean) => void): void {
    this.stateChangeListeners.push(callback);
  }

  // @contract: onIntercept(callback) => void
  // 注册拦截成功监听器（回调参数为落盘文件路径）
  onIntercept(callback: (filePath: string) => void): void {
    this.interceptListeners.push(callback);
  }

  // @contract: onError(callback) => void
  // 注册错误监听器（回调参数：错误对象 + 完整降级内容）
  onError(callback: (error: Error, content?: string) => void): void {
    this.errorListeners.push(callback);
  }
}
