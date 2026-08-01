/**
 * @intent
 * 数据层仓储接口统一出口。聚合 IFileRepository / ICodeParserRepository / ICacheRepository / IAgentRepository 接口，供 application 层用例依赖注入，data 层实现类对齐。
 * ISubProcessRunner 已于 pi-adapter-layer-reorg 上移至 application/services/（其实现为 pi 平台适配代码，留在 adapter 层，接口留 data 会造成跨层）。
 * 验收条件：
 * - 导出的每个接口在 src 内存在实现或使用方
 * - 无已删除接口的残留导出
 */


export * from './IFileRepository';
export * from './ICodeParserRepository';
export * from './ICacheRepository';
export * from './IAgentRepository';
