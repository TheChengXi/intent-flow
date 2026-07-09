import { Config } from './ConfigSchema';

// @intent: 默认配置，提供配置的默认值

export const DefaultConfig: Config = {
  mcp: {
    enabled: true,
    port: 3000
  },
  cache: {
    fileContent: {
      maxSize: '50MB'
    },
    ast: {
      maxEntries: 100
    },
    definition: {
      maxEntries: 500
    }
  },
  hooks: {
    enabled: ['cache', 'logging', 'metrics'],
    custom: []
  },
  logging: {
    level: 'info',
    output: 'console'
  },
  layerRules: {
    data: {
      maxLines: 100,
      warningMessage: '数据层文件超过 {current} 行（限制 {max} 行），建议重构',
      suggestions: [
        '将大型服务拆分为多个小服务',
        '提取通用逻辑到独立的工具类',
        '考虑使用组合模式替代继承'
      ]
    },
    application: {
      maxLines: 300,
      warningMessage: '应用层文件超过 {current} 行（限制 {max} 行），建议重构',
      suggestions: [
        '将复杂的用例拆分为多个小用例',
        '提取通用的业务逻辑到独立的服务',
        '考虑使用策略模式简化条件逻辑'
      ]
    },
    adapter: {
      maxLines: 200,
      warningMessage: '适配层文件超过 {current} 行（限制 {max} 行），是否需要封装为新组件？',
      interactive: true,
      suggestions: [
        '将复杂的适配器拆分为多个小适配器',
        '提取通用的适配逻辑到基类',
        '考虑使用装饰器模式扩展功能'
      ]
    }
  },
  autoCheck: {
    enabled: true,
    checkOnSave: true,
    checkOnCommit: true
  }
};
