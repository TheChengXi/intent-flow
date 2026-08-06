# IntentPackage.ts

`src/data/entities/IntentPackage.ts`

**intent:** 意图包的核心实体定义。 描述一个文件夹内所有 @intent 经过 LLM 聚类后的结构化分组结果。 包含内部字段（hash/pinned/deprecated/embedding）和对外字段（summary/groups/crossRefs）。 IntentPackagePublicView 是该实体的公开视图，用于对外暴露时去掉内部字段。
