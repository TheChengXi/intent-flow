// @entity: DryRunConfig
// Dry Run 模式配置
export interface DryRunConfig {
  enabled: boolean;           // 是否启用 Dry Run 模式
  outputDir: string;          // 输出目录路径
  showStatistics: boolean;    // 是否显示统计信息
}

// @contract: createDefaultConfig() => DryRunConfig
// @step: [创建默认配置] 返回默认的 Dry Run 配置
// @boundary: outputDir 默认为 '.cdd/test-output'
export function createDefaultConfig(): DryRunConfig {
  return {
    enabled: false,
    outputDir: '.cdd/test-output',
    showStatistics: true
  };
}
