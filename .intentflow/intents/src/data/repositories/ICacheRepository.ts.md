# ICacheRepository.ts

`src/data/repositories/ICacheRepository.ts`

**intent:** 缓存抽象的统一边界，避免各层独立缓存导致数据不一致与内存浪费。 屏蔽：三种缓存（文件内容/AST/定义）的统一键路由策略
