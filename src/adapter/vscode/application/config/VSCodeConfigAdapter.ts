import * as vscode from 'vscode';
import { ConfigManager } from '../../../../application/config/ConfigManager';

// @intent: VSCode 配置适配器，桥接 VSCode 配置和 ConfigManager。实现分级配置优先级：锁定配置 > VSCode 配置 > 项目配置 > 默认配置

// @entity: ConfigPriority
// 配置优先级枚举
export enum ConfigPriority {
  LOCKED = 'locked',        // 锁定配置（项目级强制）
  USER = 'user',            // 用户配置（VSCode 配置）
  PROJECT = 'project',      // 项目配置（.cdd/config.json）
  DEFAULT = 'default'       // 默认配置
}

// @entity: ConfigSource
// 配置来源信息
export interface ConfigSource {
  value: any;
  priority: ConfigPriority;
  source: string;  // 配置来源描述
}

export class VSCodeConfigAdapter {
  private configManager: ConfigManager;
  private changeListeners: Array<() => void> = [];

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  // @contract: get<T>(key: string) => T
  // @step: [检查锁定] 检查配置是否被锁定
  // @step: [锁定配置] 如果被锁定，从 ConfigManager 读取并返回
  // @step: [VSCode 配置] 尝试从 VSCode 配置读取
  // @step: [项目配置] 如果 VSCode 配置不存在，从 ConfigManager 读取
  // @step: [返回结果] 返回配置值
  // @boundary: 当配置被锁定时，忽略 VSCode 配置
  // @boundary: 当所有配置都不存在时，返回 undefined
  get<T>(key: string): T {
    // 1. 检查是否被锁定
    if (this.configManager.isLocked(key)) {
      const value = this.configManager.get<T>(key);
      console.log(`[VSCodeConfigAdapter] 配置 "${key}" 被锁定，使用项目配置: ${value}`);
      return value;
    }

    // 2. 尝试从 VSCode 配置读取
    const vscodeConfig = vscode.workspace.getConfiguration('cdd');
    const vscodeValue = vscodeConfig.get<T>(key);

    if (vscodeValue !== undefined) {
      return vscodeValue;
    }

    // 3. 回退到 ConfigManager（项目配置 + 默认配置）
    return this.configManager.get<T>(key);
  }

  // @contract: getWithSource<T>(key: string) => ConfigSource | undefined
  // @step: [检查锁定] 检查配置是否被锁定
  // @step: [锁定配置] 如果被锁定，返回锁定配置来源
  // @step: [VSCode 配置] 尝试从 VSCode 配置读取
  // @step: [项目配置] 尝试从 ConfigManager 读取
  // @step: [返回结果] 返回配置值和来源信息
  // @boundary: 当配置不存在时，返回 undefined
  getWithSource<T>(key: string): ConfigSource | undefined {
    // 1. 检查是否被锁定
    if (this.configManager.isLocked(key)) {
      const value = this.configManager.get<T>(key);
      if (value !== undefined) {
        return {
          value,
          priority: ConfigPriority.LOCKED,
          source: '.cdd/config.json (locked)'
        };
      }
    }

    // 2. 尝试从 VSCode 配置读取
    const vscodeConfig = vscode.workspace.getConfiguration('cdd');
    const vscodeValue = vscodeConfig.get<T>(key);

    if (vscodeValue !== undefined) {
      return {
        value: vscodeValue,
        priority: ConfigPriority.USER,
        source: 'VSCode Settings'
      };
    }

    // 3. 尝试从 ConfigManager 读取
    const projectValue = this.configManager.get<T>(key);
    if (projectValue !== undefined) {
      return {
        value: projectValue,
        priority: ConfigPriority.PROJECT,
        source: '.cdd/config.json'
      };
    }

    return undefined;
  }

  // @contract: set(key: string, value: any, target?: vscode.ConfigurationTarget) => Promise<void>
  // @step: [检查锁定] 检查配置是否被锁定
  // @step: [拒绝修改] 如果被锁定，抛出错误
  // @step: [写入 VSCode] 将配置写入 VSCode 配置
  // @step: [通知监听器] 触发配置变化监听器
  // @boundary: 当配置被锁定时，抛出 Error
  async set(key: string, value: any, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Promise<void> {
    // 检查是否被锁定
    if (this.configManager.isLocked(key)) {
      throw new Error(`配置 "${key}" 被项目锁定，无法修改。请联系项目管理员。`);
    }

    // 写入 VSCode 配置
    const vscodeConfig = vscode.workspace.getConfiguration('cdd');
    await vscodeConfig.update(key, value, target);

    // 通知监听器
    this.notifyListeners();
  }

  // @contract: onConfigChange(callback: () => void) => vscode.Disposable
  // @step: [注册监听器] 将回调函数添加到监听器列表
  // @step: [监听 VSCode 配置] 监听 VSCode 配置变化
  // @step: [触发回调] 当配置变化时，触发回调
  // @step: [返回 Disposable] 返回可销毁的监听器
  onConfigChange(callback: () => void): vscode.Disposable {
    // 添加到监听器列表
    this.changeListeners.push(callback);

    // 监听 VSCode 配置变化
    const disposable = vscode.workspace.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('cdd')) {
        callback();
      }
    });

    return disposable;
  }

  // @contract: notifyListeners() => void
  // @step: [遍历监听器] 遍历所有监听器
  // @step: [触发回调] 触发每个监听器的回调
  // @step: [错误处理] 捕获并记录监听器错误
  private notifyListeners(): void {
    this.changeListeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('[VSCodeConfigAdapter] 监听器错误:', error);
      }
    });
  }

  // @contract: validateLockedConfig(key: string) => { isLocked: boolean; message?: string }
  // @step: [检查锁定] 检查配置是否被锁定
  // @step: [返回结果] 返回锁定状态和提示信息
  validateLockedConfig(key: string): { isLocked: boolean; message?: string } {
    const isLocked = this.configManager.isLocked(key);

    if (isLocked) {
      return {
        isLocked: true,
        message: `配置 "${key}" 被项目锁定，无法修改。这是团队强制的配置，用于确保代码规范和安全性。`
      };
    }

    return { isLocked: false };
  }
}
