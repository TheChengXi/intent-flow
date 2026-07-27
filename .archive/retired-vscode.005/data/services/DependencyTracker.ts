import { ContractDependency } from '../entities/CompileRecord';
import * as WorkScheduleRepo from '../repositories/WorkScheduleRepo';

const dependencyMap = new Map<string, ContractDependency[]>();

// @contract: recordDependency(functionName: string, dependencies: ContractDependency[]) => void
// @step: [存储] 将依赖关系存储在内存 Map 中，key 为 functionName
// @step: [版本] 记录每个依赖契约的当前版本
export function recordDependency(functionName: string, dependencies: ContractDependency[]): void {
  dependencyMap.set(functionName, dependencies);
}
// @end

// @contract: checkOutdated(changedContracts: string[], workspaceRoot: string) => Promise<string[]>
// @step: [读取记录] 调用 WorkScheduleRepo.getAllRecords 获取所有编译记录
// @step: [遍历记录] 遍历每条记录的 dependencies
// @step: [比对版本] 检查依赖的契约名称是否在 changedContracts 中
// @step: [收集结果] 将受影响的函数名添加到结果数组
// @step: [去重] 对结果数组去重
// @boundary: 当 WorkSchedule.md 不存在时，返回空数组
// @boundary: 当 changedContracts 为空时，返回空数组
export async function checkOutdated(changedContracts: string[], workspaceRoot: string): Promise<string[]> {
  if (changedContracts.length === 0) {
    return [];
  }

  const records = await WorkScheduleRepo.getAllRecords(workspaceRoot);
  const affectedFunctions = new Set<string>();

  for (const record of records) {
    for (const dep of record.dependencies) {
      if (changedContracts.includes(dep.contractName)) {
        affectedFunctions.add(record.description);
      }
    }
  }

  return Array.from(affectedFunctions);
}
// @end

// @contract: getDependencies(functionName: string) => ContractDependency[]
// @step: [查询] 从内存 Map 中查询指定函数的依赖
// @boundary: 当函数名不存在时，返回空数组
export function getDependencies(functionName: string): ContractDependency[] {
  return dependencyMap.get(functionName) || [];
}
// @end
