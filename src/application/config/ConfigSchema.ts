// @intent: 配置结构定义，定义配置文件的类型

export interface Config {
  mcp: MCPConfig;
  cache: CacheConfig;
  hooks: HooksConfig;
  logging: LoggingConfig;
  layerRules: LayerRulesConfig;
  autoCheck: AutoCheckConfig;
  locked?: LockedConfig;  // 锁定配置（项目级强制）
}

// @entity: LockedConfig
// 锁定配置，用于项目级强制配置
// @note: 锁定的配置项不能被用户级配置覆盖
export interface LockedConfig {
  // 锁定的配置键列表（使用点分隔符，如 "hooks.enabled"）
  keys: string[];
}

export interface MCPConfig {
  enabled: boolean;
  port: number;
}

export interface CacheConfig {
  fileContent: {
    maxSize: string;  // 例如 "50MB"
  };
  ast: {
    maxEntries: number;
  };
  definition: {
    maxEntries: number;
  };
}

export interface HooksConfig {
  enabled: string[];  // 启用的内置 Hook 名称列表
  custom: string[];   // 自定义 Hook 路径列表（第二版）
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  output: 'console' | 'file';
}

export interface LayerRulesConfig {
  data: LayerRule;
  application: LayerRule;
  adapter: LayerRule;
}

export interface LayerRule {
  maxLines: number;
  warningMessage: string;
  suggestions: string[];
  interactive?: boolean;  // 是否需要用户交互
}

export interface AutoCheckConfig {
  enabled: boolean;
  checkOnSave: boolean;
  checkOnCommit: boolean;
}
