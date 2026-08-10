/**
 * @intent
 * Dry Run 模式的配置契约与默认值来源，定义"是否启用、输出目录、统计开关"三个配置项及默认工厂。
 * 边界：默认输出目录固定为 .intentflow/test-output，createDefaultConfig 返回全新对象。
 * 验收条件：
 * - createDefaultConfig() 返回 enabled=false 的默认配置
 */

// @entity: DryRunConfig
// Dry Run 模式配置
export interface DryRunConfig {
  enabled: boolean;           // 是否启用 Dry Run 模式
  outputDir: string;          // 输出目录路径
  showStatistics: boolean;    // 是否显示统计信息
}

// @contract: createDefaultConfig() => DryRunConfig
// @step: [创建默认配置] 返回默认的 Dry Run 配置
// @boundary: outputDir 默认为 '.intentflow/test-output'
export function createDefaultConfig(): DryRunConfig {
  return {
    enabled: false,
    outputDir: '.intentflow/test-output',
    showStatistics: true
  };
}
