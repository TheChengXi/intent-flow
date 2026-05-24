// @entity: ChangelogEntry
// CHANGELOG.md 中的一条变更记录
export interface ChangelogEntry {
  date: string;
  file: string;
  content: string;
  reason: string;
  type: ChangelogType;
}

// @enum: ChangelogType
// 变更类型（BR-005）
export type ChangelogType =
  | '[ITERATION]'
  | '[HOTFIX]'
  | '[BACKTRACK]'
  | '[PARADIGM SHIFT]';
