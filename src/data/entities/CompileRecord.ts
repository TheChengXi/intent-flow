// @entity: CompileRecord
// WorkSchedule.md 中的一条编译记录
export interface CompileRecord {
  date: string;
  time: string;
  role: string;
  description: string;
  duration: number;
  dependencies: ContractDependency[];
}

// @entity: ContractDependency
// 记录编译时依赖的契约版本
export interface ContractDependency {
  contractName: string;
  version: string;
}
