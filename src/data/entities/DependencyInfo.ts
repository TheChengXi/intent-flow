// @intent: 依赖信息实体，表示代码依赖的详细信息

// @entity: DependencyInfo
// 依赖信息
export interface DependencyInfo {
  type: 'function' | 'class' | 'method';  // 依赖类型
  name: string;                            // 依赖名称
  filePath: string;                        // 文件路径
  code: string;                            // 完整代码
  contract?: string;                       // @contract 注释（如果有）
}
