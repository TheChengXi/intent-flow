# CacheRepositoryImpl.ts

`src/data/services/cache/CacheRepositoryImpl.ts`

**intent:** 唯一的缓存门面。实现 ICacheRepository 供 use case 通过 DI 使用， 同时提供便捷方法供 searchers/extractors 通过静态 getInstance() 访问。 屏蔽：键格式 "type:identifier" 的路由分发逻辑；三种缓存各自的 TTL 和容量策略差异
