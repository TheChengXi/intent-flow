// @entity: ReviewReport
// 代码审查报告
export interface ReviewReport {
  functionName: string;
  date: string;
  dimensions: ReviewDimension[];
  conclusion: ReviewConclusion;
  inconsistencies: Inconsistency[];
}

// @enum: ReviewConclusion
// 审查结论分级（BR-002）
export type ReviewConclusion = 'PASS' | 'MINOR_DEVIATION' | 'MAJOR_VIOLATION';

// @entity: ReviewDimension
// 审查维度结果
export interface ReviewDimension {
  name: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  details: string;
}

// @entity: Inconsistency
// 注释与代码的不一致项
export interface Inconsistency {
  line: number;
  type: InconsistencyType;
  description: string;
}

// @enum: InconsistencyType
// 不一致类型
export type InconsistencyType =
  | 'CONTRACT_MISMATCH'
  | 'STEP_MISSING'
  | 'BOUNDARY_MISSING'
  | 'EXTRA_BEHAVIOR';
