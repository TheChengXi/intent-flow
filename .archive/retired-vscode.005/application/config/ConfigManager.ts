import * as fs from 'fs';
import * as path from 'path';
import { Config } from './ConfigSchema';
import { DefaultConfig } from './DefaultConfig';

/**
 * @intent
 * 配置的集中管理点，合并默认配置与本地配置文件。
 * 屏蔽：对 fs 的直接依赖（读取配置文件）；静态单例跨模块共享同个配置实例
 */

export class ConfigManager {
  private static instance: ConfigManager;
  private config: Config;

  private constructor() {
    this.config = { ...DefaultConfig };
  }

  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  async load(workspaceRoot: string): Promise<void> {
    const configPath = path.join(workspaceRoot, '.cdd', 'config.json');

    try {
      await fs.promises.access(configPath);
      const content = await fs.promises.readFile(configPath, 'utf-8');
      const userConfig = JSON.parse(content);
      this.config = this.deepMerge(DefaultConfig, userConfig);
      console.log(`[ConfigManager] 已加载配置: ${configPath}`);
    } catch (error) {
      console.warn(`[ConfigManager] 配置文件不存在或格式错误，使用默认配置`);
      this.config = { ...DefaultConfig };
    }
  }

  get<T = unknown>(key: string): T {
    const keys = key.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let value: any = this.config;

    for (const k of keys) {
      if (value && typeof value === 'object' && k in value) {
        value = value[k];
      } else {
        return undefined as T;
      }
    }

    return value as T;
  }

  // @contract: isLocked(key: string) => boolean
  // @step: [检查锁定配置] 检查指定的配置键是否被锁定
  // @step: [返回结果] 如果被锁定返回 true，否则返回 false
  // @boundary: 当 locked.keys 不存在时，返回 false
  isLocked(key: string): boolean {
    const lockedKeys = this.config.locked?.keys || [];
    return lockedKeys.includes(key);
  }

  set(key: string, value: unknown): void {
    const keys = key.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let obj: any = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in obj) || typeof obj[k] !== 'object' || obj[k] === null) {
        obj[k] = {};
      }
      obj = obj[k];
    }

    obj[keys[keys.length - 1]] = value;
  }

  getAll(): Config {
    return { ...this.config };
  }

  async save(workspaceRoot: string): Promise<void> {
    const configPath = path.join(workspaceRoot, '.cdd', 'config.json');
    const configDir = path.dirname(configPath);

    await fs.promises.mkdir(configDir, { recursive: true });
    const content = JSON.stringify(this.config, null, 2);
    await fs.promises.writeFile(configPath, content, 'utf-8');

    console.log(`[ConfigManager] 已保存配置: ${configPath}`);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private deepMerge(target: any, source: any): any {
    const result = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (
          typeof source[key] === 'object' &&
          source[key] !== null &&
          !Array.isArray(source[key])
        ) {
          result[key] = this.deepMerge(result[key] || {}, source[key]);
        } else {
          result[key] = source[key];
        }
      }
    }

    return result;
  }

  reset(): void {
    this.config = { ...DefaultConfig };
    console.log('[ConfigManager] 已重置为默认配置');
  }
}
