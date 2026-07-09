// @intent: 依赖树实体，表示文件及其依赖的树形结构

// @entity: DependencyBranch
// 依赖枝条：文件的意图及其依赖的意图树
export interface DependencyBranch {
  filePath: string;                  // 文件路径
  fileName: string;                  // 文件名
  intent: string;                    // 文件意图（@intent 注释）
  dependencies: DependencyBranch[];  // 依赖的文件列表
}
