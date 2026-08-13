/**
 * @intent
 * 应用层用例统一导出。聚合 CLI/MCP 共享的 4 个用例。
 * agent 域用例已随 pi 适配层入档（pi-removal），不再导出。
 * 验收条件：
 * - 导出的每个用例在 src 内存在至少一处活跃引用
 * - 无已移除用例的残留导出
 */

export * from './IUseCase';
export * from './CheckFileSizeUseCase';
export * from './TraceDependencyChainUseCase';
export * from './ProjectIntentUseCase';
// @warn: GenerateIntentPackageUseCase/MaintainIntentPackagesUseCase 已废弃
export * from './ListFolderIntentsUseCase';
