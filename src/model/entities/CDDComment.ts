import * as vscode from 'vscode';

// 表示一个完整的 CDD 注释块
export interface CDDComment {
  contract: ContractAnnotation;
  steps: StepAnnotation[];
  boundaries: BoundaryAnnotation[];
  range: vscode.Range;
}


// @constraint: version 用于依赖追踪，格式为 functionName:vX.Y
export interface ContractAnnotation {
  functionName: string;
  parameters: Parameter[];
  returnType: string;
  throwsTypes: string[];
  version: string;
}

export interface Parameter {
  name: string;
  type: string;
}

// @constraint: isSimple 为 true 时，审查员跳过该步骤的严格检查
export interface StepAnnotation {
  description: string;
  isSimple: boolean;
}

// @entity: BoundaryAnnotation
export interface BoundaryAnnotation {
  description: string;
}
