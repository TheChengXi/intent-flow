/**
 * @intent
 * 数据层仓储接口统一出口。聚合 IFileRepository / ICodeParserRepository / ICacheRepository 接口，供 application 层用例依赖注入，data 层实现类对齐。
 * agent 域仓库接口已随 pi 适配层入档（pi-removal），不再导出。
 * 验收条件：
 * - 导出的每个接口在 src 内存在实现或使用方
 * - 无已删除接口的残留导出
 */


export * from './IFileRepository';
export * from './ICodeParserRepository';
export * from './ICacheRepository';
