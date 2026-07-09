/**
 * @intent
 * 意图包的核心实体定义。
 * 描述一个文件夹内所有 @intent 经过 LLM 聚类后的结构化分组结果。
 * 包含内部字段（hash/pinned/deprecated/embedding）和对外字段（summary/groups/crossRefs）。
 * IntentPackagePublicView 是该实体的公开视图，用于对外暴露时去掉内部字段。
 */

/** 文件引用：文件路径 + 该文件的 @intent 原文 */
export interface IntentFileRef {
  path: string;
  intent: string;
}

/** 语义分组：一组语义相关的文件及其高层意图描述 */
export interface IntentGroup {
  name: string;
  intent: string;
  files: IntentFileRef[];
}

/** 跨包弱引用：指向另一个意图包及其关联原因 */
export interface CrossReference {
  target: string;
  reason: string;
}

/**
 * @entity IntentPackage
 * 意图包完整存储结构（包含内部字段）。
 * 存储在 .cdd/packages/<packageName>.yml。
 */
export interface IntentPackage {
  packageName: string;
  summary: string;
  groups: IntentGroup[];
  crossRefs: CrossReference[];

  // 内部字段（对外屏蔽）
  hash: string;
  pinned: boolean;
  deprecated: boolean;
  embedding: number[];
}

/**
 * @entity IntentPackagePublicView
 * 意图包的对外展示视图（去掉 hash / pinned / deprecated / embedding）。
 */
export interface IntentPackagePublicView {
  packageName: string;
  summary: string;
  groups: IntentGroup[];
  crossRefs: CrossReference[];
  stale?: boolean;
}
