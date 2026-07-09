// @intent: 项目结构实体，表示项目的模块和架构信息

// @entity: ProjectModule
// 项目模块
export interface ProjectModule {
  moduleName: string;           // 模块名
  files: ProjectFile[];         // 文件列表
  dependencies: string[];       // 依赖的模块列表
}

// @entity: ProjectFile
// 项目文件
export interface ProjectFile {
  filePath: string;             // 文件路径
  fileName: string;             // 文件名
  intent: string;               // 文件意图
  lineCount: number;            // 行数
}

// @entity: ProjectStructure
// 项目结构
export interface ProjectStructure {
  modules: ProjectModule[];     // 模块列表
  summary: ProjectSummary;      // 架构摘要
}

// @entity: ProjectSummary
// 项目摘要
export interface ProjectSummary {
  totalFiles: number;           // 总文件数
  totalModules: number;         // 总模块数
  maxDependencyDepth: number;   // 最大依赖深度
}
