// @intent: 缓存统计信息实体，表示缓存的使用情况

// @entity: CacheStats
// 缓存统计信息
export interface CacheStats {
  fileContent: CacheTypeStats;   // 文件内容缓存统计
  ast: CacheTypeStats;           // AST 缓存统计
  definition: DefinitionCacheStats;  // 定义缓存统计
}

// @entity: CacheTypeStats
// 缓存类型统计
export interface CacheTypeStats {
  size: number;          // 当前大小（字节）
  count: number;         // 条目数量
  maxCapacity: number;   // 最大容量
}

// @entity: DefinitionCacheStats
// 定义缓存统计
export interface DefinitionCacheStats {
  functionCount: number;  // 函数定义数量
  typeCount: number;      // 类型定义数量
  maxCapacity: number;    // 最大容量
}
