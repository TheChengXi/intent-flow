/**
 * @intent
 * 数据层实体类型统一出口。各实体在独立文件中定义，本文件聚合为单一 import 源，供上层（application/adapter）按需引用。
 * agent 域实体已随 pi 适配层入档（pi-removal），不再导出。
 *
 * 验收条件：
 * - 导出的每个实体在 src 内存在至少一处活跃引用
 * - 无已删除实体的残留导出
 */

export * from './FunctionDefinition';
export * from './TypeDefinition';
export * from './CacheStats';
export * from './FileSizeCheckResult';
